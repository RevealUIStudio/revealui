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

import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
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

/** Rotate `spoolPath` aside (never deletes -- "never drop events silently"). */
async function rotateSpool(spoolPath: string): Promise<void> {
  const rotatedPath = `${spoolPath}.${Date.now()}.rotated`;
  await rename(spoolPath, rotatedPath);
  process.stderr.write(
    `revealui-harnesses hook: spool exceeded ${DEFAULT_SPOOL_MAX_BYTES} bytes, rotated to ${rotatedPath}\n`,
  );
}

/**
 * Append one hook decision to the JSONL spool at `spoolPath`, creating the
 * parent directory and the file as needed. Rotates (never truncates or
 * drops) when the existing file would exceed `maxBytes`.
 */
export async function appendToSpool(
  record: SpoolRecord,
  spoolPath: string,
  maxBytes: number = DEFAULT_SPOOL_MAX_BYTES,
): Promise<SpoolAppendResult> {
  await mkdir(dirname(spoolPath), { recursive: true });

  const line = `${JSON.stringify(record)}\n`;
  let rotated = false;

  try {
    const { size } = await stat(spoolPath);
    if (size + Buffer.byteLength(line, 'utf8') > maxBytes) {
      await rotateSpool(spoolPath);
      rotated = true;
    }
  } catch {
    // Spool doesn't exist yet -- nothing to rotate.
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
 * SPOOL-ONLY MODE (multi-editor harness design doc §6, Phase B acceptance):
 * `POST /api/harness/receipts` does not exist yet -- it ships in Phase A.
 * When `config.endpoint` is unset this no-ops with a single warn line (not
 * one per call) and never throws; when it IS set, this still returns
 * `not-implemented` today rather than guessing at a wire format Phase A
 * hasn't shipped. Wiring the real POST is Phase A's job.
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

  return { flushed: false, reason: 'not-implemented' };
}

/** Test-only: reset the single-warn latch between test cases. */
export function resetFlushWarnLatchForTests(): void {
  warnedNotConfigured = false;
}
