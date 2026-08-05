import { execSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { controlManifestPath } from './paths.js';
import { loadManifest, saveManifest } from './store.js';
import type {
  ConfirmTmpscriptOptions,
  RegisterTmpscriptInput,
  SweepTmpscriptResult,
  TmpscriptEntry,
  TmpscriptManifest,
  TmpscriptStoreOptions,
} from './types.js';

/** Days after which a still-pending entry is expired for sweep. */
export const PENDING_TTL_DAYS = 7;
/** Days after confirm before the manifest entry is pruned. */
export const ENTRY_RETENTION_DAYS = 30;

export function ageDays(iso: string): number {
  return (Date.now() - Date.parse(iso)) / 86400000;
}

export function findEntry(m: TmpscriptManifest, key: string): TmpscriptEntry | undefined {
  const resolved = resolve(key);
  return m.entries.find((e) => e.id === key || e.path === key || e.path === resolved);
}

export function pendingEntries(m?: TmpscriptManifest): TmpscriptEntry[] {
  const manifest = m ?? loadManifest();
  return manifest.entries.filter((e) => e.status === 'pending');
}

export function registerTmpscript(
  input: RegisterTmpscriptInput,
  options?: TmpscriptStoreOptions & { pathExists?: (p: string) => boolean },
): TmpscriptEntry {
  const resolved = resolve(input.path);
  const pathExists = options?.pathExists ?? existsSync;
  if (!pathExists(resolved)) {
    throw new Error(`tmpscript: file not found: ${resolved}`);
  }

  const m = loadManifest(options);
  if (findEntry(m, resolved)) {
    throw new Error(`tmpscript: already registered: ${resolved}`);
  }

  const id = input.id?.trim() || `${basename(resolved)}-${Date.now().toString(36)}`;
  if (findEntry(m, id)) {
    throw new Error(`tmpscript: id already exists: ${id}`);
  }

  const entry: TmpscriptEntry = {
    id,
    path: resolved,
    purpose: input.purpose?.trim() || '(no purpose given)',
    validate: input.validate?.trim() || null,
    session: String(process.ppid || 0),
    created: new Date().toISOString(),
    status: 'pending',
    confirmed: null,
  };
  m.entries.push(entry);
  saveManifest(m, options);
  return entry;
}

function defaultRunValidate(cmd: string): void {
  // shell:true is intentional: validate is a user-authored shell fragment
  // (same contract as the legacy Claude adapter).
  execSync(cmd, {
    stdio: 'inherit',
    timeout: 60_000,
    shell: process.env.SHELL || '/bin/sh',
  });
}

/**
 * Run optional validate command (must exit 0), then delete the file and mark
 * confirmed. Validation failure leaves status pending and keeps the file.
 */
export function confirmTmpscript(key: string, options?: ConfirmTmpscriptOptions): TmpscriptEntry {
  const m = loadManifest(options);
  const e = findEntry(m, key);
  if (!e) {
    throw new Error(`tmpscript: no entry for: ${key}`);
  }
  if (e.status === 'confirmed') {
    return e;
  }

  if (e.validate) {
    const run = options?.runValidate ?? defaultRunValidate;
    try {
      run(e.validate);
    } catch {
      throw new Error(`tmpscript: validation FAILED — ${e.id} stays pending, file kept`);
    }
  }

  const pathExists = options?.pathExists ?? existsSync;
  const unlink = options?.unlinkPath ?? unlinkSync;
  if (pathExists(e.path)) {
    try {
      unlink(e.path);
    } catch {
      /* already gone or unreadable — still confirm so lifecycle closes */
    }
  }

  e.status = 'confirmed';
  e.confirmed = new Date().toISOString();
  saveManifest(m, options);
  return e;
}

/**
 * Remove expired pending files, leftover confirmed files, mark expired
 * pending confirmed, prune old confirmed entries.
 */
export function sweepTmpscript(options?: ConfirmTmpscriptOptions): SweepTmpscriptResult {
  const m = loadManifest(options);
  const pathExists = options?.pathExists ?? existsSync;
  const unlink = options?.unlinkPath ?? unlinkSync;
  let removedFiles = 0;

  for (const e of m.entries) {
    const exists = pathExists(e.path);
    const stale = e.status === 'pending' && ageDays(e.created) > PENDING_TTL_DAYS;
    const leftover = e.status === 'confirmed' && exists;
    if (exists && (stale || leftover)) {
      try {
        unlink(e.path);
        removedFiles += 1;
      } catch {
        /* keep going */
      }
      if (stale) {
        e.status = 'confirmed';
        e.confirmed = new Date().toISOString();
        e.sweptAsExpired = true;
      }
    } else if (stale && !exists) {
      e.status = 'confirmed';
      e.confirmed = new Date().toISOString();
      e.sweptAsExpired = true;
    }
  }

  const before = m.entries.length;
  m.entries = m.entries.filter((e) => {
    if (e.status !== 'confirmed' || !e.confirmed) return true;
    return ageDays(e.confirmed) <= ENTRY_RETENTION_DAYS;
  });
  saveManifest(m, options);
  return {
    removedFiles,
    prunedEntries: before - m.entries.length,
    remaining: m.entries.length,
  };
}

/** Format session-boundary check (warn-only; always informational). */
export function formatCheckLines(m?: TmpscriptManifest): string[] {
  const pending = pendingEntries(m);
  if (pending.length === 0) return [];
  const lines: string[] = [
    `[tmpscript] ${pending.length} temp script(s) awaiting confirm+cleanup:`,
  ];
  for (const e of pending) {
    const days = ageDays(e.created).toFixed(1);
    const missing = existsSync(e.path) ? '' : ' (file MISSING — confirm to close)';
    lines.push(`  ${e.id} — ${e.purpose} — ${days}d old${missing}`);
    lines.push(`    → revealui-harnesses tmpscript confirm ${e.id}`);
  }
  lines.push(`[tmpscript] store: ${controlManifestPath()}`);
  return lines;
}
