import { randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import {
  checkParents,
  isMissing,
  MAX_CHECKED_FILE_BYTES,
  readCheckedFile,
  sameIdentity,
} from './files.js';
import {
  controlManifestPath,
  legacyClaudeManifestPath,
  previousControlManifestPath,
} from './paths.js';
import type { TmpscriptEntry, TmpscriptManifest, TmpscriptStoreOptions } from './types.js';

const text = z.string().min(1);
const date = text.refine((s) => Number.isFinite(Date.parse(s)), 'invalid timestamp');
const hash = z
  .string()
  .length(64)
  .refine((s) => [...s].every((c) => '0123456789abcdef'.includes(c)), 'invalid sha256');
const absolute = text.refine(isAbsolute, 'expected absolute path');
const decimal = text.refine(
  (s) => [...s].every((c) => '0123456789'.includes(c)),
  'invalid identity',
);
const identity = z
  .object({
    dev: decimal,
    ino: decimal,
    mode: decimal,
    uid: decimal,
    nlink: decimal,
    size: decimal,
    mtimeNs: decimal,
    ctimeNs: decimal,
    sha256: hash,
  })
  .strict();
const common = {
  id: text,
  path: absolute,
  purpose: text,
  validate: z.string().nullable(),
  session: text,
  created: date,
  confirmed: date.nullable(),
  sweptAsExpired: z.boolean().optional(),
};
const legacyEntry = z.object({ ...common, status: z.enum(['pending', 'confirmed']) }).strict();
const entry = z
  .object({
    ...common,
    status: z.enum(['pending', 'confirmed', 'held']),
    artifactClass: z.enum(['helper', 'source', 'data', 'unknown']),
    owner: z.object({ tool: text, session: text }).strict(),
    sensitivity: z.enum(['public', 'confidential', 'unknown']),
    disposition: z.literal('retain'),
    consumers: z.array(
      z.object({ reference: text, state: z.enum(['active', 'released', 'unknown']) }).strict(),
    ),
    lease: z.enum(['active', 'released', 'unknown']),
    identity: identity.nullable(),
    completion: z
      .object({ kind: z.literal('sha256'), sha256: hash, evidence: text, recordedAt: date })
      .strict()
      .nullable(),
    preservation: z
      .object({ path: absolute, sha256: hash, sourceSha256: hash, verifiedAt: date })
      .strict()
      .nullable(),
  })
  .strict();
const schema = z
  .object({
    version: z.literal(2),
    revision: z.number().int().nonnegative(),
    store: absolute,
    entries: z.array(entry),
  })
  .strict();
const legacySchema = z
  .object({ version: z.literal(1), store: z.string().optional(), entries: z.array(legacyEntry) })
  .strict();

function unique(entries: Array<{ id: string; path: string }>): void {
  if (
    new Set(entries.map((e) => e.id)).size !== entries.length ||
    new Set(entries.map((e) => resolve(e.path))).size !== entries.length
  )
    throw new Error('tmpscript: duplicate id or path');
}
function validateCurrent(manifest: unknown): TmpscriptManifest {
  const data = schema.parse(manifest);
  unique(data.entries);
  for (const e of data.entries) {
    if (
      e.status === 'confirmed' &&
      (!(e.completion && e.identity) ||
        e.completion.sha256 !== e.identity.sha256 ||
        e.confirmed !== e.completion.recordedAt)
    )
      throw new Error('tmpscript: inconsistent completion');
    if (e.status !== 'confirmed' && e.completion)
      throw new Error('tmpscript: unexpected completion evidence');
    if (e.status === 'pending' && e.confirmed)
      throw new Error('tmpscript: pending artifact has a confirmation timestamp');
    if (e.status !== 'held' && e.validate)
      throw new Error('tmpscript: historical validation requires held status');
    if (
      e.preservation &&
      (!e.identity ||
        e.preservation.sourceSha256 !== e.identity.sha256 ||
        e.preservation.sha256 !== e.identity.sha256 ||
        e.sensitivity !== 'public')
    )
      throw new Error('tmpscript: inconsistent preservation evidence');
  }
  return data;
}
type CheckedSnapshot = ReturnType<typeof readCheckedFile>;
function parseSnapshot(file: CheckedSnapshot, path: string, target: string): TmpscriptManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(file.data));
  } catch {
    throw new Error('tmpscript: malformed manifest');
  }
  const current = schema.safeParse(parsed);
  if (current.success) {
    return { ...validateCurrent(current.data), store: target };
  }
  const old = legacySchema.safeParse(parsed);
  if (!old.success) throw new Error('tmpscript: invalid manifest schema');
  unique(old.data.entries);
  return {
    version: 2,
    revision: 0,
    store: target,
    importRequired: { path, sha256: file.identity.sha256 },
    entries: old.data.entries.map(
      (e): TmpscriptEntry => ({
        ...e,
        status: 'held',
        artifactClass: 'unknown',
        owner: { tool: 'legacy-import', session: e.session },
        sensitivity: 'unknown',
        disposition: 'retain',
        consumers: [{ reference: 'legacy consumers not reviewed', state: 'unknown' }],
        lease: 'unknown',
        identity: null,
        completion: null,
        preservation: null,
      }),
    ),
  };
}
function readManifestSnapshot(
  path: string,
  target: string,
): { manifest: TmpscriptManifest; file: CheckedSnapshot } | undefined {
  let file: CheckedSnapshot;
  try {
    file = readCheckedFile(path);
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
  return { manifest: parseSnapshot(file, path, target), file };
}
function targetPath(options?: TmpscriptStoreOptions): string {
  return resolve(options?.controlPath ?? controlManifestPath());
}
/** Pure inspection, including a visible read-only legacy view when applicable. */
export function loadManifest(options?: TmpscriptStoreOptions): TmpscriptManifest {
  const target = targetPath(options);
  const current = readManifestSnapshot(target, target);
  if (current) return current.manifest;
  const sources = options?.controlPath
    ? [options.legacyPath, options.previousPath]
    : [
        options?.previousPath ?? previousControlManifestPath(),
        options?.legacyPath ?? legacyClaudeManifestPath(),
      ];
  const found = [...new Set(sources.filter((p): p is string => Boolean(p)))]
    .filter((p) => resolve(p) !== target)
    .flatMap((p) => {
      const snapshot = readManifestSnapshot(p, target);
      if (!snapshot) return [];
      return [
        {
          ...snapshot.manifest,
          importRequired: { path: p, sha256: snapshot.file.identity.sha256 },
        },
      ];
    });
  if (found.length > 1)
    throw new Error('tmpscript: multiple legacy stores; explicitly select an import source');
  return found[0] ?? { version: 2, revision: 0, store: target, entries: [] };
}
function withLock<T>(target: string, action: () => T): T {
  // Check existing ancestors before mkdir, then validate the complete chain.
  let parent = dirname(target);
  while (true) {
    try {
      checkParents(`${parent}/manifest`);
      break;
    } catch (error) {
      if (!isMissing(error)) throw error;
      parent = dirname(parent);
    }
  }
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  checkParents(target);
  const parentStat = lstatSync(dirname(target));
  if (process.getuid && parentStat.uid !== process.getuid())
    throw new Error('tmpscript: state directory belongs to another user');
  const lock = `${target}.lock`;
  let fd: number;
  try {
    fd = openSync(
      lock,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
  } catch {
    throw new Error('tmpscript: state locked or inaccessible; no automatic stale-lock removal');
  }
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    writeFileSync(fd, JSON.stringify({ pid: process.pid, created: new Date().toISOString() }));
    fsyncSync(fd);
    outcome = { ok: true, value: action() };
  } catch (error) {
    outcome = { ok: false, error };
  }
  const cleanupErrors: unknown[] = [];
  try {
    closeSync(fd);
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    unlinkSync(lock);
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (!outcome.ok) {
    if (cleanupErrors.length && outcome.error instanceof ManifestPublishedError) {
      outcome.error.cleanupErrors.push(...cleanupErrors);
      outcome.error.message += '; lock cleanup also failed';
    } else if (cleanupErrors.length) {
      throw new AggregateError(
        [outcome.error, ...cleanupErrors],
        'tmpscript: operation and lock cleanup failed; reread before retrying',
        { cause: outcome.error },
      );
    }
    throw outcome.error;
  }
  if (cleanupErrors.length)
    throw new AggregateError(
      cleanupErrors,
      'tmpscript: operation completed but lock cleanup failed; reread before retrying',
    );
  return outcome.value;
}
/** The new revision is visible, but a directory durability barrier failed. */
export class ManifestPublishedError extends Error {
  readonly code = 'TMPSCRIPT_PUBLISHED_DURABILITY_UNCONFIRMED';
  readonly published = true;
  readonly cleanupErrors: unknown[] = [];
  constructor(
    readonly store: string,
    readonly revision: number,
    cause: unknown,
  ) {
    super(
      `tmpscript: revision ${revision} published with durability unconfirmed; reread before retrying`,
      { cause },
    );
    this.name = 'ManifestPublishedError';
  }
}
function writeAtomic(target: string, manifest: TmpscriptManifest): void {
  const output = validateCurrent(manifest);
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CHECKED_FILE_BYTES)
    throw new Error('tmpscript: serialized manifest exceeds read limit');
  const temporary = `${target}.${randomUUID()}.tmp`;
  const fd = openSync(
    temporary,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    try {
      writeFileSync(fd, serialized);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, target);
  } catch (error) {
    try {
      unlinkSync(temporary);
    } catch (cleanupError) {
      if (!isMissing(cleanupError))
        throw new AggregateError(
          [error, cleanupError],
          'tmpscript: write and temporary cleanup failed',
        );
    }
    throw error;
  }
  try {
    const directory = openSync(
      dirname(target),
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  } catch (error) {
    throw new ManifestPublishedError(target, output.revision, error);
  }
}
/** Compare-and-swap prevents callers holding an old snapshot from losing updates. */
export function saveManifest(manifest: TmpscriptManifest, options?: TmpscriptStoreOptions): void {
  const target = targetPath(options);
  withLock(target, () => {
    const current = loadManifest(options);
    if (current.importRequired || manifest.importRequired)
      throw new Error('tmpscript: explicit import required');
    if (resolve(manifest.store) !== target) throw new Error('tmpscript: store mismatch');
    if (current.revision !== manifest.revision) throw new Error('tmpscript: revision conflict');
    writeAtomic(target, { ...manifest, store: target, revision: current.revision + 1 });
  });
}
export function updateManifest<T>(
  options: TmpscriptStoreOptions | undefined,
  update: (m: TmpscriptManifest) => T,
): T {
  const target = targetPath(options);
  return withLock(target, () => {
    const current = loadManifest(options);
    if (current.importRequired) throw new Error('tmpscript: explicit import required');
    const result = update(current);
    writeAtomic(target, { ...current, revision: current.revision + 1 });
    return result;
  });
}
/** Explicit import retains the original bytes; conflicting destinations are never merged. */
export function importManifest(source: string, options?: TmpscriptStoreOptions): TmpscriptManifest {
  const target = targetPath(options);
  source = resolve(source);
  return withLock(target, () => {
    const existing = readManifestSnapshot(target, target);
    if (existing && (source !== target || !existing.manifest.importRequired))
      throw new Error('tmpscript: import destination exists');
    const original = source === target && existing ? existing.file : readCheckedFile(source);
    const imported = parseSnapshot(original, source, target);
    if (source === target) {
      const backup = `${target}.v1-${original.identity.sha256}.json`;
      try {
        writeFileSync(backup, original.data, { flag: 'wx', mode: 0o600 });
      } catch (error) {
        if (readCheckedFile(backup).identity.sha256 !== original.identity.sha256) throw error;
      }
      if (readCheckedFile(backup).identity.sha256 !== original.identity.sha256)
        throw new Error('tmpscript: import backup mismatch');
      const backupFd = openSync(backup, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        fsyncSync(backupFd);
      } finally {
        closeSync(backupFd);
      }
      const parentFd = openSync(
        dirname(backup),
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      try {
        fsyncSync(parentFd);
      } finally {
        closeSync(parentFd);
      }
    }
    if (!sameIdentity(readCheckedFile(source).identity, original.identity))
      throw new Error('tmpscript: import source changed');
    const result: TmpscriptManifest = {
      version: 2,
      revision: 1,
      store: target,
      entries: imported.entries.map((e) => ({
        ...e,
        status: 'held',
        disposition: 'retain',
        lease: 'unknown',
        identity: null,
        completion: null,
        preservation: null,
      })),
    };
    writeAtomic(target, result);
    return result;
  });
}
