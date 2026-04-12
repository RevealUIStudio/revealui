import {
  closeSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';

const DEFAULT_TIMEOUT_MS = 2000;
const RETRY_MS = 50;

/**
 * Check whether a process is still running.
 * Uses signal 0 which doesn't actually send a signal  -  just checks existence.
 */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Acquire an exclusive file lock using O_EXCL (kernel-level atomic create).
 * Writes the current PID to the lock file for dead-holder detection.
 *
 * Spins with a 50ms interval until timeout. If the current lock holder
 * is dead (process no longer running), the lock is stolen.
 *
 * @returns true if the lock was acquired, false on timeout
 */
export function acquireLock(lockPath: string, timeoutMs = DEFAULT_TIMEOUT_MS): boolean {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const fd = openSync(lockPath, 'wx');
      writeSync(fd, String(process.pid));
      closeSync(fd);
      return true;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') return false;
      // Lock exists  -  check if holder is alive
      // Note: inherent TOCTOU between read and unlink, acceptable for advisory file locks
      try {
        const holderPid = Number.parseInt(readFileSync(lockPath, 'utf8').trim(), 10);
        if (!(Number.isNaN(holderPid) || isPidAlive(holderPid))) {
          // Holder crashed  -  steal the lock (re-acquisition via O_EXCL is atomic)
          unlinkSync(lockPath);
          continue;
        }
      } catch {
        // Lock file disappeared between checks  -  retry immediately
        continue;
      }
      // Busy-wait
      const spinUntil = Date.now() + RETRY_MS;
      while (Date.now() < spinUntil) {
        /* spin */
      }
    }
  }
  return false;
}

/**
 * Release a file lock. Swallows ENOENT (already released).
 */
export function releaseLock(lockPath: string): void {
  try {
    unlinkSync(lockPath);
  } catch {
    // Already released or never acquired  -  non-fatal
  }
}

/**
 * Execute a synchronous function while holding the file lock.
 * The lock is always released, even if fn throws.
 */
export function withLock<T>(lockPath: string, fn: () => T, timeoutMs?: number): T {
  const acquired = acquireLock(lockPath, timeoutMs);
  if (!acquired) {
    throw new Error(
      `Failed to acquire lock: ${lockPath} (timeout ${timeoutMs ?? DEFAULT_TIMEOUT_MS}ms)`,
    );
  }
  try {
    return fn();
  } finally {
    releaseLock(lockPath);
  }
}

/**
 * Execute an async function while holding the file lock.
 * The lock is always released, even if fn throws.
 */
export async function withLockAsync<T>(
  lockPath: string,
  fn: () => Promise<T>,
  timeoutMs?: number,
): Promise<T> {
  const acquired = acquireLock(lockPath, timeoutMs);
  if (!acquired) {
    throw new Error(
      `Failed to acquire lock: ${lockPath} (timeout ${timeoutMs ?? DEFAULT_TIMEOUT_MS}ms)`,
    );
  }
  try {
    return await fn();
  } finally {
    releaseLock(lockPath);
  }
}

/**
 * Write a file atomically: write to a temporary file, then rename.
 * rename() on the same filesystem is atomic at the kernel level.
 */
export function atomicWriteSync(filePath: string, content: string): void {
  const suffix = `${process.pid}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const tmpPath = `${filePath}.tmp.${suffix}`;
  writeFileSync(tmpPath, content, 'utf8');
  renameSync(tmpPath, filePath);
}

/**
 * Derive a lock path from a workboard path (.md → .lock).
 */
export function lockPathFor(workboardPath: string): string {
  return workboardPath.replace(/\.md$/, '.lock');
}
