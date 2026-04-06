/**
 * Offline mutation queue — stores pending mutations in localStorage
 * so they survive page reloads and can be flushed when connectivity returns.
 */

/** localStorage key for the persisted queue. */
const STORAGE_KEY = 'revealui:offline-queue';

/** A single pending mutation waiting to be sent to the server. */
export interface OfflineMutation {
  /** Unique identifier for this mutation (UUID). */
  id: string;
  /** Database table the mutation targets. */
  table: string;
  /** Type of operation. */
  operation: 'insert' | 'update' | 'delete';
  /** Mutation payload (row data or partial update). */
  data: Record<string, unknown>;
  /** ISO-8601 timestamp when the mutation was enqueued. */
  timestamp: string;
}

/**
 * Check whether `localStorage` is available.
 * Returns `false` during SSR or in private-browsing contexts that throw on access.
 */
function hasLocalStorage(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const testKey = '__revealui_ls_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the current queue from localStorage.
 * Returns an empty array when storage is unavailable or the data is corrupt.
 */
function readQueue(): OfflineMutation[] {
  if (!hasLocalStorage()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as OfflineMutation[];
  } catch {
    return [];
  }
}

/**
 * Persist the queue to localStorage.
 * Silently ignores errors (e.g. quota exceeded, private browsing).
 */
function writeQueue(queue: OfflineMutation[]): void {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Quota exceeded or private browsing — drop silently.
  }
}

/**
 * Manages a FIFO queue of mutations that were created while the browser
 * was offline. Mutations are persisted in `localStorage` under the key
 * `revealui:offline-queue`.
 *
 * All operations are no-ops when `localStorage` is unavailable (SSR,
 * private browsing that throws, etc.).
 */
export class OfflineMutationQueue {
  /**
   * Add a mutation to the end of the queue.
   *
   * @param mutation - The mutation to enqueue (must include a unique `id`).
   */
  enqueue(mutation: OfflineMutation): void {
    const queue = readQueue();
    queue.push(mutation);
    writeQueue(queue);
  }

  /**
   * Execute all queued mutations in order via the provided executor.
   * Each mutation is removed from the persisted queue only after the
   * executor resolves successfully. Processing stops at the first failure
   * so ordering is preserved.
   *
   * @param executor - Async function that sends a single mutation to the server.
   */
  async flush(executor: (mutation: OfflineMutation) => Promise<void>): Promise<void> {
    const queue = readQueue();

    for (const mutation of queue) {
      await executor(mutation);
      // Remove the successfully-processed mutation from storage.
      const current = readQueue();
      const updated = current.filter((m) => m.id !== mutation.id);
      writeQueue(updated);
    }
  }

  /**
   * Return all pending mutations without removing them.
   */
  peek(): OfflineMutation[] {
    return readQueue();
  }

  /**
   * Number of mutations currently in the queue.
   */
  get size(): number {
    return readQueue().length;
  }

  /**
   * Remove all pending mutations from the queue.
   */
  clear(): void {
    if (!hasLocalStorage()) {
      return;
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore — same guard as writeQueue.
    }
  }
}
