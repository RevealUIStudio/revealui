import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  acquireLock,
  atomicWriteSync,
  lockPathFor,
  releaseLock,
  withLock,
  withLockAsync,
} from '../workboard/file-lock.js';

function tmpLock(): string {
  return join(tmpdir(), `file-lock-test-${Date.now()}-${Math.random().toString(36).slice(2)}.lock`);
}

describe('acquireLock / releaseLock', () => {
  let lockPath: string;

  beforeEach(() => {
    lockPath = tmpLock();
  });

  afterEach(() => {
    try {
      unlinkSync(lockPath);
    } catch {}
  });

  it('acquires a lock and writes PID', () => {
    expect(acquireLock(lockPath)).toBe(true);
    const content = readFileSync(lockPath, 'utf8');
    expect(Number.parseInt(content, 10)).toBe(process.pid);
    releaseLock(lockPath);
  });

  it('cannot acquire a lock already held by this process', () => {
    expect(acquireLock(lockPath)).toBe(true);
    // Second acquire with a very short timeout should fail (same PID = alive)
    expect(acquireLock(lockPath, 100)).toBe(false);
    releaseLock(lockPath);
  });

  it('release removes the lock file', () => {
    acquireLock(lockPath);
    releaseLock(lockPath);
    expect(existsSync(lockPath)).toBe(false);
  });

  it('release swallows ENOENT when lock already removed', () => {
    // Should not throw
    releaseLock(lockPath);
  });

  it('steals lock from dead holder', () => {
    // Write a lock file with a PID that does not exist (99999999)
    writeFileSync(lockPath, '99999999', 'utf8');
    expect(acquireLock(lockPath, 500)).toBe(true);
    const content = readFileSync(lockPath, 'utf8');
    expect(Number.parseInt(content, 10)).toBe(process.pid);
    releaseLock(lockPath);
  });

  it('times out when lock is held by a live process', () => {
    acquireLock(lockPath);
    const start = Date.now();
    expect(acquireLock(lockPath, 200)).toBe(false);
    expect(Date.now() - start).toBeGreaterThanOrEqual(150); // actually waited
    releaseLock(lockPath);
  });
});

describe('withLock', () => {
  let lockPath: string;

  beforeEach(() => {
    lockPath = tmpLock();
  });

  afterEach(() => {
    try {
      unlinkSync(lockPath);
    } catch {}
  });

  it('executes fn and releases lock', () => {
    const result = withLock(lockPath, () => 42);
    expect(result).toBe(42);
    expect(existsSync(lockPath)).toBe(false);
  });

  it('releases lock even if fn throws', () => {
    expect(() =>
      withLock(lockPath, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(existsSync(lockPath)).toBe(false);
  });

  it('throws on timeout', () => {
    acquireLock(lockPath); // hold the lock
    expect(() => withLock(lockPath, () => {}, 100)).toThrow('Failed to acquire lock');
    releaseLock(lockPath);
  });
});

describe('withLockAsync', () => {
  let lockPath: string;

  beforeEach(() => {
    lockPath = tmpLock();
  });

  afterEach(() => {
    try {
      unlinkSync(lockPath);
    } catch {}
  });

  it('executes async fn and releases lock', async () => {
    const result = await withLockAsync(lockPath, async () => 'hello');
    expect(result).toBe('hello');
    expect(existsSync(lockPath)).toBe(false);
  });

  it('releases lock even if async fn rejects', async () => {
    await expect(
      withLockAsync(lockPath, async () => {
        throw new Error('async boom');
      }),
    ).rejects.toThrow('async boom');
    expect(existsSync(lockPath)).toBe(false);
  });
});

describe('atomicWriteSync', () => {
  let filePath: string;

  beforeEach(() => {
    filePath = join(tmpdir(), `atomic-write-test-${Date.now()}.txt`);
  });

  afterEach(() => {
    try {
      unlinkSync(filePath);
    } catch {}
  });

  it('writes content atomically', () => {
    atomicWriteSync(filePath, 'hello world');
    expect(readFileSync(filePath, 'utf8')).toBe('hello world');
  });

  it('overwrites existing content', () => {
    writeFileSync(filePath, 'old content');
    atomicWriteSync(filePath, 'new content');
    expect(readFileSync(filePath, 'utf8')).toBe('new content');
  });

  it('leaves no tmp file behind', () => {
    atomicWriteSync(filePath, 'data');
    const tmpPath = `${filePath}.tmp.${process.pid}`;
    expect(existsSync(tmpPath)).toBe(false);
  });
});

describe('lockPathFor', () => {
  it('converts .md to .lock', () => {
    expect(lockPathFor('/tmp/workboard.md')).toBe('/tmp/workboard.lock');
  });

  it('only replaces trailing .md', () => {
    expect(lockPathFor('/tmp/my.md.file.md')).toBe('/tmp/my.md.file.lock');
  });
});
