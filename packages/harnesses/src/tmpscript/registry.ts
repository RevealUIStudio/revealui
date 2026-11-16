import { randomUUID } from 'node:crypto';
import { dirname, relative, resolve, sep } from 'node:path';
import { readCheckedFile, sameIdentity } from './files.js';
import { controlManifestPath } from './paths.js';
import { loadManifest, updateManifest } from './store.js';
import type {
  ConfirmTmpscriptOptions,
  RegisterTmpscriptInput,
  SweepTmpscriptResult,
  TmpscriptEntry,
  TmpscriptManifest,
  TmpscriptStoreOptions,
} from './types.js';
/** Age is a review signal, never removal authority. */
export const PENDING_TTL_DAYS = 7;
export const ENTRY_RETENTION_DAYS = 30;
export function ageDays(iso: string): number {
  return (Date.now() - Date.parse(iso)) / 86400000;
}
export function findEntry(m: TmpscriptManifest, key: string): TmpscriptEntry | undefined {
  const matches = m.entries.filter((e) => e.id === key || e.path === resolve(key));
  if (matches.length > 1) throw new Error('tmpscript: ambiguous entry');
  return matches[0];
}
export function pendingEntries(m?: TmpscriptManifest): TmpscriptEntry[] {
  return (m ?? loadManifest()).entries.filter((e) => e.status !== 'confirmed');
}
export function registerTmpscript(
  input: RegisterTmpscriptInput,
  options?: TmpscriptStoreOptions,
): TmpscriptEntry {
  if (input.validate?.trim())
    throw new Error(
      'tmpscript: shell validation is unsupported; use explicit SHA-256 completion evidence',
    );
  const path = resolve(input.path);
  const stateDirectory = dirname(resolve(options?.controlPath ?? controlManifestPath()));
  const withinState = relative(stateDirectory, path);
  if (
    withinState === '' ||
    (withinState !== '..' && !withinState.startsWith(`..${sep}`) && !withinState.startsWith(sep))
  )
    throw new Error('tmpscript: registry state cannot be registered as an artifact');
  const identity = readCheckedFile(path).identity;
  return updateManifest(options, (m) => {
    if (findEntry(m, path)) throw new Error('tmpscript: path already registered');
    const id = input.id?.trim() || randomUUID();
    if (findEntry(m, id)) throw new Error('tmpscript: id already registered');
    const session = String(process.ppid);
    const e: TmpscriptEntry = {
      id,
      path,
      purpose: input.purpose?.trim() || '(purpose not reviewed)',
      validate: null,
      session,
      created: new Date().toISOString(),
      status: 'pending',
      confirmed: null,
      artifactClass: input.artifactClass ?? 'unknown',
      owner: input.owner ?? { tool: 'operator', session },
      sensitivity: input.sensitivity ?? 'unknown',
      disposition: 'retain',
      consumers: input.consumers ?? [{ reference: 'consumers not reviewed', state: 'unknown' }],
      lease: 'unknown',
      identity,
      completion: null,
      preservation: null,
    };
    if (!sameIdentity(identity, readCheckedFile(path).identity))
      throw new Error('tmpscript: artifact changed during registration');
    m.entries.push(e);
    return e;
  });
}
/** Explicit outcome attestation bound to the unchanged artifact; does not execute or delete it. */
export function confirmTmpscript(key: string, options?: ConfirmTmpscriptOptions): TmpscriptEntry {
  if (!(options?.expectedSha256 && options.evidence?.trim()))
    throw new Error(
      'tmpscript: confirm requires expectedSha256 and completion evidence; source is retained',
    );
  return updateManifest(options, (m) => {
    const e = findEntry(m, key);
    if (!e) throw new Error('tmpscript: entry not found');
    if (!e.identity || e.status === 'held')
      throw new Error('tmpscript: legacy entry held for owner reconciliation');
    const current = readCheckedFile(e.path).identity;
    if (options.expectedSha256 !== e.identity.sha256 || !sameIdentity(current, e.identity))
      throw new Error('tmpscript: artifact identity or content changed');
    if (e.status === 'confirmed') return e;
    const now = new Date().toISOString();
    e.completion = {
      kind: 'sha256',
      sha256: current.sha256,
      evidence: options.evidence?.trim() ?? '',
      recordedAt: now,
    };
    e.status = 'confirmed';
    e.confirmed = now;
    return e;
  });
}
/** Verify a separate byte-for-byte preservation copy. Confidential copies require their owning encrypted workflow. */
export function preserveTmpscript(
  key: string,
  copyPath: string,
  options?: TmpscriptStoreOptions,
): TmpscriptEntry {
  return updateManifest(options, (m) => {
    const e = findEntry(m, key);
    if (!e?.identity || e.sensitivity !== 'public')
      throw new Error(
        'tmpscript: public artifact required; use owning encrypted preservation workflow for other data',
      );
    const source = readCheckedFile(e.path).identity;
    const copy = readCheckedFile(resolve(copyPath)).identity;
    if (
      !sameIdentity(source, e.identity) ||
      copy.sha256 !== source.sha256 ||
      (source.dev === copy.dev && source.ino === copy.ino)
    )
      throw new Error('tmpscript: preservation does not match a separate unchanged source');
    if (
      !(
        sameIdentity(source, readCheckedFile(e.path).identity) &&
        sameIdentity(copy, readCheckedFile(resolve(copyPath)).identity)
      )
    )
      throw new Error('tmpscript: preservation changed during verification');
    e.preservation = {
      path: resolve(copyPath),
      sha256: copy.sha256,
      sourceSha256: source.sha256,
      verifiedAt: new Date().toISOString(),
    };
    return e;
  });
}
/** Proposal only. Retains pending work, completed work, receipts and unknown leases. */
export function sweepTmpscript(options?: TmpscriptStoreOptions): SweepTmpscriptResult {
  const m = loadManifest(options);
  return {
    removedFiles: 0,
    prunedEntries: 0,
    remaining: m.entries.length,
    candidates: m.entries
      .filter(
        (e) =>
          e.status === 'held' || e.status === 'confirmed' || ageDays(e.created) > PENDING_TTL_DAYS,
      )
      .map((e) => ({
        id: e.id,
        reason:
          e.status === 'held'
            ? 'legacy review required; retain'
            : 'owner review required; age and completion do not authorize removal',
      })),
  };
}
export function formatCheckLines(m?: TmpscriptManifest): string[] {
  const manifest = m ?? loadManifest();
  const pending = pendingEntries(manifest);
  const lines = manifest.importRequired
    ? ['[tmpscript] legacy store requires explicit import; inspection made no changes']
    : [];
  if (pending.length)
    lines.push(
      `[tmpscript] ${pending.length} artifact(s) need owner review; all source files retained`,
    );
  for (const e of pending)
    lines.push(`  ${JSON.stringify(e.id)}: ${e.status}, ${ageDays(e.created).toFixed(1)}d old`);
  return lines;
}
