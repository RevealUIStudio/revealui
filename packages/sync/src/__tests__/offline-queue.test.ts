import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OfflineMutation } from '../offline-queue.js';
import { OfflineMutationQueue } from '../offline-queue.js';

const STORAGE_KEY = 'revealui:offline-queue';

function makeMutation(overrides?: Partial<OfflineMutation>): OfflineMutation {
  return {
    id: overrides?.id ?? crypto.randomUUID(),
    table: overrides?.table ?? 'conversations',
    operation: overrides?.operation ?? 'insert',
    data: overrides?.data ?? { title: 'Test' },
    timestamp: overrides?.timestamp ?? new Date().toISOString(),
  };
}

describe('OfflineMutationQueue', () => {
  let queue: OfflineMutationQueue;

  beforeEach(() => {
    queue = new OfflineMutationQueue();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- enqueue ----

  describe('enqueue', () => {
    it('should add a mutation to the queue', () => {
      const mutation = makeMutation();
      queue.enqueue(mutation);

      expect(queue.size).toBe(1);
      const items = queue.peek();
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual(mutation);
    });

    it('should preserve insertion order', () => {
      const first = makeMutation({ id: 'first' });
      const second = makeMutation({ id: 'second' });
      const third = makeMutation({ id: 'third' });

      queue.enqueue(first);
      queue.enqueue(second);
      queue.enqueue(third);

      const items = queue.peek();
      expect(items.map((m) => m.id)).toEqual(['first', 'second', 'third']);
    });

    it('should persist to localStorage', () => {
      const mutation = makeMutation();
      queue.enqueue(mutation);

      const raw = window.localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!) as OfflineMutation[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0]!.id).toBe(mutation.id);
    });
  });

  // ---- peek ----

  describe('peek', () => {
    it('should return empty array when queue is empty', () => {
      expect(queue.peek()).toEqual([]);
    });

    it('should not remove items from the queue', () => {
      queue.enqueue(makeMutation());
      queue.peek();
      expect(queue.size).toBe(1);
    });
  });

  // ---- size ----

  describe('size', () => {
    it('should return 0 for empty queue', () => {
      expect(queue.size).toBe(0);
    });

    it('should return correct count', () => {
      queue.enqueue(makeMutation());
      queue.enqueue(makeMutation());
      expect(queue.size).toBe(2);
    });
  });

  // ---- clear ----

  describe('clear', () => {
    it('should remove all mutations', () => {
      queue.enqueue(makeMutation());
      queue.enqueue(makeMutation());
      expect(queue.size).toBe(2);

      queue.clear();
      expect(queue.size).toBe(0);
      expect(queue.peek()).toEqual([]);
    });

    it('should remove the localStorage key', () => {
      queue.enqueue(makeMutation());
      queue.clear();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  // ---- flush ----

  describe('flush', () => {
    it('should execute all mutations in order', async () => {
      const executed: string[] = [];
      const m1 = makeMutation({ id: 'a' });
      const m2 = makeMutation({ id: 'b' });
      const m3 = makeMutation({ id: 'c' });

      queue.enqueue(m1);
      queue.enqueue(m2);
      queue.enqueue(m3);

      await queue.flush(async (m) => {
        executed.push(m.id);
      });

      expect(executed).toEqual(['a', 'b', 'c']);
      expect(queue.size).toBe(0);
    });

    it('should remove each mutation after successful execution', async () => {
      const m1 = makeMutation({ id: 'keep' });
      const m2 = makeMutation({ id: 'also-keep' });

      queue.enqueue(m1);
      queue.enqueue(m2);
      expect(queue.size).toBe(2);

      const sizeAfterEachFlush: number[] = [];
      await queue.flush(async () => {
        // Capture size *after* each prior mutation was removed.
        // The executor is called before the current mutation is removed,
        // so the first call still sees 2 and the second sees 1.
        sizeAfterEachFlush.push(queue.size);
      });

      // First executor call: both still in queue (removal happens after executor).
      // Second executor call: first was removed, second still in queue.
      expect(sizeAfterEachFlush).toEqual([2, 1]);
      // After flush completes, queue is empty.
      expect(queue.size).toBe(0);
    });

    it('should stop on first failure', async () => {
      const m1 = makeMutation({ id: 'ok' });
      const m2 = makeMutation({ id: 'fail' });
      const m3 = makeMutation({ id: 'never-reached' });

      queue.enqueue(m1);
      queue.enqueue(m2);
      queue.enqueue(m3);

      const executed: string[] = [];
      await expect(
        queue.flush(async (m) => {
          executed.push(m.id);
          if (m.id === 'fail') {
            throw new Error('Network error');
          }
        }),
      ).rejects.toThrow('Network error');

      // First mutation was processed and removed.
      // Second failed mid-execution so it and the third remain.
      expect(executed).toEqual(['ok', 'fail']);
      // 'ok' was removed, 'fail' and 'never-reached' remain.
      expect(queue.size).toBe(2);
    });

    it('should be a no-op when queue is empty', async () => {
      const executor = vi.fn();
      await queue.flush(executor);
      expect(executor).not.toHaveBeenCalled();
    });
  });

  // ---- localStorage edge cases ----

  describe('localStorage edge cases', () => {
    it('should handle corrupt data gracefully', () => {
      window.localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
      expect(queue.peek()).toEqual([]);
      expect(queue.size).toBe(0);
    });

    it('should handle non-array data gracefully', () => {
      window.localStorage.setItem(STORAGE_KEY, '"just a string"');
      expect(queue.peek()).toEqual([]);
    });

    it('should handle localStorage setItem throwing', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      // Should not throw — silently drops the write.
      expect(() => queue.enqueue(makeMutation())).not.toThrow();
    });

    it('should handle localStorage removeItem throwing', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('SecurityError');
      });

      // Should not throw.
      expect(() => queue.clear()).not.toThrow();
    });

    it('should work across multiple queue instances', () => {
      const queue2 = new OfflineMutationQueue();

      const mutation = makeMutation({ id: 'shared' });
      queue.enqueue(mutation);

      // Second instance reads from the same localStorage.
      expect(queue2.size).toBe(1);
      expect(queue2.peek()[0]!.id).toBe('shared');
    });
  });
});
