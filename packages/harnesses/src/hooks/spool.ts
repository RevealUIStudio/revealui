/**
 * Local Receipt Spool
 *
 * Implements multi-editor harness design doc §3-B "availability-first
 * delivery": a hook that blocks the user's editor on network latency is a
 * product-killer, so every hook decision is appended to a local,
 * append-only JSONL spool first and flushed to the receipts-ingest server
 * (a separate build phase; see `POST /api/harness/receipts` in the design
 * doc §3-B) asynchronously. This module never drops an event silently --
 * on overflow it rotates the spool file (renaming the full file aside) and
 * keeps appending to a fresh one, and it warns on every rotation.
 */

import { appendFile, mkdir, open, readFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { HarnessHookEvent } from '../types/hook-event.js';
import type { PolicyDecision } from './policy.js';

/** Bound the spool file size before rotating (10 MB, matches the OpenCode adapter's execFile buffer bound). */
export const DEFAULT_SPOOL_MAX_BYTES = 10 * 1024 * 1024;

/** One line appended to the spool for every hook decision. */
export interface SpoolRecord {
  readonly event: HarnessHookEvent;
  readonly decision: PolicyDecision;
  readonly spooledAt: string;
}

export interface SpoolAppendResult {
  readonly appended: true;
  /** True when this append triggered a rotation (the prior spool was full). */
  readonly rotated: boolean;
}

/**
 * Rotate `spoolPath` aside (never deletes -- "never drop events silently").
 * Tolerates a concurrent rotation: if a peer hook invocation already renamed
 * the file away, the `ENOENT` is swallowed rather than thrown, since the
 * outcome ("this spool is rotated aside") is already true.
 */
async function rotateSpool(spoolPath: string): Promise<void> {
  const rotatedPath = `${spoolPath}.${Date.now()}.rotated`;
  try {
    await rename(spoolPath, rotatedPath);
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    if (code === 'ENOENT') return;
    throw err;
  }
  process.stderr.write(
    `revealui-harnesses hook: spool exceeded ${DEFAULT_SPOOL_MAX_BYTES} bytes, rotated to ${rotatedPath}\n`,
  );
}

/**
 * Size of the spool at `spoolPath`, read through an open file descriptor
 * (`fstat`) rather than a path `stat`. Reading the size from the handle -- not
 * from a detached path lookup a concurrent hook invocation could invalidate
 * before the append below -- removes the check-then-use race on the path
 * (CodeQL js/file-system-race). Returns 0 when the spool does not exist yet.
 */
async function currentSpoolSize(spoolPath: string): Promise<number> {
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(spoolPath, 'r');
  } catch {
    return 0;
  }
  try {
    return (await handle.stat()).size;
  } finally {
    await handle.close();
  }
}

/**
 * Append one hook decision to the JSONL spool at `spoolPath`, creating the
 * parent directory and the file as needed. Rotates (never truncates or
 * drops) when appending this line to the existing file would exceed
 * `maxBytes` -- the overflowing line then starts a fresh spool.
 */
export async function appendToSpool(
  record: SpoolRecord,
  spoolPath: string,
  maxBytes: number = DEFAULT_SPOOL_MAX_BYTES,
): Promise<SpoolAppendResult> {
  await mkdir(dirname(spoolPath), { recursive: true });

  const line = `${JSON.stringify(record)}\n`;
  const currentSize = await currentSpoolSize(spoolPath);

  let rotated = false;
  if (currentSize > 0 && currentSize + Buffer.byteLength(line, 'utf8') > maxBytes) {
    await rotateSpool(spoolPath);
    rotated = true;
  }

  await appendFile(spoolPath, line, 'utf8');
  return { appended: true, rotated };
}

/** Configuration for a (currently unimplemented) flush to the receipts-ingest server. */
export interface FlushConfig {
  /** `POST /api/harness/receipts` endpoint URL. Unset = spool-only mode. */
  readonly endpoint?: string;
  /** `rvui_dev_` device token, read from env at call time only -- never logged. */
  readonly token?: string;
}

export type FlushResult =
  | { readonly flushed: true }
  | {
      readonly flushed: false;
      readonly reason: 'not-configured' | 'not-implemented' | 'request-failed';
    };

let warnedNotConfigured = false;

/**
 * Attempt to flush the local spool to the receipts-ingest server.
 *
 * When `config.endpoint` is unset: spool-only mode (warn once, never throw).
 * When set with a token: POST the spool lines as `{ receipts: [...] }` to
 * `POST /api/harness/receipts` (GAP-381 Phase A). Failures return
 * `request-failed` without throwing so hooks never block on network.
 */
export function flushSpool(spoolPath: string, config: FlushConfig): FlushResult {
  if (!config.endpoint) {
    if (!warnedNotConfigured) {
      process.stderr.write(
        `revealui-harnesses hook: no receipts endpoint configured, spool-only mode -- receipts stay local at ${spoolPath}\n`,
      );
      warnedNotConfigured = true;
    }
    return { flushed: false, reason: 'not-configured' };
  }

  if (!config.token) {
    return { flushed: false, reason: 'not-configured' };
  }

  // Sync API cannot await fetch. Callers that can await should use flushSpoolAsync.
  return { flushed: false, reason: 'not-implemented' };
}

/** Map a spool line to the Phase A ingest receipt body. */
function spoolRecordToReceipt(record: SpoolRecord): Record<string, unknown> {
  const { event, decision } = record;
  return {
    source: event.source,
    kind: event.kind,
    enforcementTier: event.enforcementTier,
    decision: decision.permission,
    toolName: event.toolName,
    identity: event.identity,
    raw: event.raw,
  };
}

/**
 * Async flush used by the hook CLI after spool append (GAP-381 Phase A).
 * Reads NDJSON spool, POSTs to `POST /api/harness/receipts` with the device token.
 */
export async function flushSpoolAsync(
  spoolPath: string,
  config: FlushConfig,
): Promise<FlushResult> {
  if (!config.endpoint) {
    return flushSpool(spoolPath, config);
  }
  if (!config.token) {
    return { flushed: false, reason: 'not-configured' };
  }

  let text: string;
  try {
    text = await readFile(spoolPath, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { flushed: true };
    return { flushed: false, reason: 'request-failed' };
  }

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { flushed: true };

  const receipts: Record<string, unknown>[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as SpoolRecord;
      if (parsed?.event && parsed?.decision) {
        receipts.push(spoolRecordToReceipt(parsed));
      }
    } catch {
      // Skip corrupt lines; do not abort the batch.
    }
  }
  if (receipts.length === 0) return { flushed: true };

  try {
    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ receipts }),
    });
    if (!res.ok) return { flushed: false, reason: 'request-failed' };
    return { flushed: true };
  } catch {
    return { flushed: false, reason: 'request-failed' };
  }
}

/** Test-only: reset the single-warn latch between test cases. */
export function resetFlushWarnLatchForTests(): void {
  warnedNotConfigured = false;
}
