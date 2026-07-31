/**
 * Archive a session exit into the RevFleet cold archive.
 *
 * Destination (operator convention, not product git):
 *   $REVFLEET_ARCHIVE/cold/sessions/daemon/   when REVFLEET_ARCHIVE is the parent
 *   $REVFLEET_ARCHIVE/sessions/daemon/        when REVFLEET_ARCHIVE is already cold/
 *   default: ~/revfleet/archive/cold/sessions/daemon/
 *
 * Purpose: keep a durable, centralized record of ended sessions so live peer
 * lists and workboard state stay clean. Soft-optional: never throws.
 */

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface SessionExitRecord {
  readonly agentId: string;
  readonly endedAt: string;
  readonly exitSummary: string;
  readonly backend?: string;
  readonly workDir?: string;
  readonly task?: string;
  readonly ppid?: string | number;
  readonly source: string;
  readonly daemonEnded: boolean;
  readonly notes?: string;
}

export interface ArchiveExitResult {
  readonly ok: boolean;
  readonly path?: string;
  readonly ledgerPath?: string;
  readonly reason?: string;
}

/** Resolve cold sessions/daemon directory under the fleet archive. */
export function coldDaemonSessionsDir(): string {
  const env = process.env.REVFLEET_ARCHIVE?.trim();
  if (env) {
    // Parent layout: ~/revfleet/archive → cold/sessions/daemon
    // Cold layout:   ~/revfleet/archive/cold → sessions/daemon
    if (env.endsWith('/cold') || env.endsWith('\\cold') || /[/\\]cold$/.test(env)) {
      return join(env, 'sessions', 'daemon');
    }
    return join(env, 'cold', 'sessions', 'daemon');
  }
  return join(homedir(), 'revfleet', 'archive', 'cold', 'sessions', 'daemon');
}

function safeSlug(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'session';
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Write one exit record + append a ledger line.
 * Soft: returns ok:false on I/O errors; never throws.
 */
export function archiveSessionExit(record: SessionExitRecord): ArchiveExitResult {
  try {
    const dir = coldDaemonSessionsDir();
    mkdirSync(dir, { recursive: true });
    const fileName = `${stamp()}-${safeSlug(record.agentId)}.json`;
    const filePath = join(dir, fileName);
    const body = `${JSON.stringify(record, null, 2)}\n`;
    writeFileSync(filePath, body, { encoding: 'utf8', mode: 0o600 });

    const ledgerPath = join(dir, 'ledger.jsonl');
    const line = `${JSON.stringify({
      endedAt: record.endedAt,
      agentId: record.agentId,
      exitSummary: record.exitSummary,
      backend: record.backend,
      workDir: record.workDir,
      task: record.task,
      daemonEnded: record.daemonEnded,
      source: record.source,
      file: fileName,
    })}\n`;
    appendFileSync(ledgerPath, line, { encoding: 'utf8', mode: 0o600 });

    return { ok: true, path: filePath, ledgerPath };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
