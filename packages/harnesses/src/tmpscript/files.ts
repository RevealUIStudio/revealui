import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, parse, resolve } from 'node:path';
import type { ArtifactIdentity } from './types.js';

export function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
/** Reject symlinks in every component, including directories used for state. */
export function checkParents(path: string): void {
  if (!isAbsolute(path) || path.includes('\0'))
    throw new Error('tmpscript: expected an absolute path');
  let dir = dirname(path);
  while (true) {
    const s = lstatSync(dir);
    if (!s.isDirectory() || s.isSymbolicLink())
      throw new Error('tmpscript: unsafe parent directory');
    if ((s.mode & 0o022) !== 0 && (s.mode & 0o1000) === 0)
      throw new Error('tmpscript: writable parent directory');
    if (dir === parse(dir).root) break;
    dir = dirname(dir);
  }
}
export const MAX_CHECKED_FILE_BYTES = 16 * 1024 * 1024;

export function readCheckedFile(
  path: string,
  limit = MAX_CHECKED_FILE_BYTES,
): { data: Buffer; identity: ArtifactIdentity } {
  const absolute = resolve(path);
  checkParents(absolute);
  const fd = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.size > BigInt(limit))
      throw new Error('tmpscript: expected a bounded single-link regular file');
    if (process.getuid && before.uid !== BigInt(process.getuid()))
      throw new Error('tmpscript: file belongs to another user');
    const data = readFileSync(fd);
    if (data.length > limit) throw new Error('tmpscript: file exceeded read limit');
    const after = fstatSync(fd, { bigint: true });
    const current = lstatSync(absolute, { bigint: true });
    for (const key of [
      'dev',
      'ino',
      'mode',
      'uid',
      'nlink',
      'size',
      'mtimeNs',
      'ctimeNs',
    ] as const) {
      if (before[key] !== after[key] || before[key] !== current[key])
        throw new Error('tmpscript: file changed during read');
    }
    return {
      data,
      identity: {
        dev: String(before.dev),
        ino: String(before.ino),
        mode: String(before.mode),
        uid: String(before.uid),
        nlink: String(before.nlink),
        size: String(before.size),
        mtimeNs: String(before.mtimeNs),
        ctimeNs: String(before.ctimeNs),
        sha256: createHash('sha256').update(data).digest('hex'),
      },
    };
  } finally {
    closeSync(fd);
  }
}
export function sameIdentity(a: ArtifactIdentity, b: ArtifactIdentity): boolean {
  return (Object.keys(a) as Array<keyof ArtifactIdentity>).every((key) => a[key] === b[key]);
}
