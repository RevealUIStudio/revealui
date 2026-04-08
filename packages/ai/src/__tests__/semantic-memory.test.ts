import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SemanticMemory } from '../memory/stores/semantic-memory.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a unit vector of the given dimension (all equal components) */
function uniformVec(dim: number): number[] {
  const val = 1 / Math.sqrt(dim);
  return Array(dim).fill(val);
}

/** Returns a vector with a 1 at position `pos` and 0s elsewhere */
function basisVec(dim: number, pos: number): number[] {
  return Array.from({ length: dim }, (_, i) => (i === pos ? 1 : 0));
}

// ---------------------------------------------------------------------------

describe('SemanticMemory', () => {
  let memory: SemanticMemory;

  beforeEach(() => {
    memory = new SemanticMemory();
  });

  // -------------------------------------------------------------------------
  // store / get
  // -------------------------------------------------------------------------

  describe('store and get', () => {
    it('stores an entry and retrieves it by key', async () => {
      await memory.store('k1', 'hello world');
      const entry = await memory.get('k1');
      expect(entry).not.toBeNull();
      expect(entry!.key).toBe('k1');
      expect(entry!.content).toBe('hello world');
    });

    it('returns null for a missing key', async () => {
      const entry = await memory.get('missing');
      expect(entry).toBeNull();
    });

    it('stores an entry with an embedding vector', async () => {
      const vec = basisVec(4, 0);
      await memory.store('k2', 'content', vec);
      const entry = await memory.get('k2');
      expect(entry!.embedding).toEqual(vec);
    });

    it('stores an entry with metadata', async () => {
      await memory.store('k3', 'content', undefined, { source: 'test' });
      const entry = await memory.get('k3');
      expect(entry!.metadata).toEqual({ source: 'test' });
    });

    it('overwrites an existing key', async () => {
      await memory.store('k1', 'first');
      await memory.store('k1', 'second');
      const entry = await memory.get('k1');
      expect(entry!.content).toBe('second');
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete', () => {
    it('removes an entry from the store', async () => {
      await memory.store('k1', 'content');
      await memory.delete('k1');
      expect(await memory.get('k1')).toBeNull();
    });

    it('does not throw when deleting a non-existent key', async () => {
      await expect(memory.delete('no-such-key')).resolves.toBeUndefined();
    });

    it('decrements size after deletion', async () => {
      await memory.store('k1', 'a');
      await memory.store('k2', 'b');
      expect(memory.size).toBe(2);
      await memory.delete('k1');
      expect(memory.size).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // search
  // -------------------------------------------------------------------------

  describe('search', () => {
    it('returns an empty array when no entries are stored', async () => {
      const results = await memory.search(basisVec(4, 0));
      expect(results).toEqual([]);
    });

    it('returns ranked results by cosine similarity', async () => {
      // dim-4 basis vectors — each is perfectly orthogonal to the others
      await memory.store('match', 'exact match', basisVec(4, 0));
      await memory.store('partial', 'partial', basisVec(4, 1));
      await memory.store('other', 'unrelated', basisVec(4, 2));

      // Query with the first basis vector → 'match' should score 1, others 0
      const results = await memory.search(basisVec(4, 0));
      expect(results[0].key).toBe('match');
      expect(results[0].score).toBeCloseTo(1);
      expect(results[1].score).toBeCloseTo(0);
    });

    it('respects the topK limit', async () => {
      for (let i = 0; i < 10; i++) {
        await memory.store(`k${i}`, `content ${i}`, uniformVec(4));
      }
      const results = await memory.search(uniformVec(4), 3);
      expect(results).toHaveLength(3);
    });

    it('returns all entries when topK exceeds count', async () => {
      await memory.store('a', 'a', basisVec(4, 0));
      await memory.store('b', 'b', basisVec(4, 1));
      const results = await memory.search(uniformVec(4), 10);
      expect(results).toHaveLength(2);
    });

    it('handles entries without embeddings (score 0)', async () => {
      await memory.store('no-vec', 'no embedding');
      await memory.store('has-vec', 'has embedding', basisVec(4, 0));
      const results = await memory.search(basisVec(4, 0));
      // Entry with embedding should rank above no-embedding entry
      expect(results[0].key).toBe('has-vec');
      expect(results[0].score).toBeCloseTo(1);
      expect(results[1].score).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // list / size
  // -------------------------------------------------------------------------

  describe('list and size', () => {
    it('lists all stored entries', async () => {
      await memory.store('a', 'alpha');
      await memory.store('b', 'beta');
      const all = memory.list();
      expect(all).toHaveLength(2);
      expect(all.map((e) => e.key)).toContain('a');
      expect(all.map((e) => e.key)).toContain('b');
    });

    it('size reflects the current entry count', async () => {
      expect(memory.size).toBe(0);
      await memory.store('x', 'x');
      expect(memory.size).toBe(1);
      await memory.store('y', 'y');
      expect(memory.size).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // TTL eviction
  // -------------------------------------------------------------------------

  describe('TTL eviction', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns null for an expired entry', async () => {
      const mem = new SemanticMemory({ ttlMs: 100 });
      await mem.store('k', 'content');
      vi.advanceTimersByTime(200);
      expect(await mem.get('k')).toBeNull();
    });

    it('excludes expired entries from search results', async () => {
      const mem = new SemanticMemory({ ttlMs: 100 });
      await mem.store('expired', 'gone', basisVec(4, 0));
      vi.advanceTimersByTime(200);
      const results = await mem.search(basisVec(4, 0));
      expect(results).toHaveLength(0);
    });

    it('excludes expired entries from list', async () => {
      const mem = new SemanticMemory({ ttlMs: 100 });
      await mem.store('expired', 'gone');
      vi.advanceTimersByTime(200);
      expect(mem.list()).toHaveLength(0);
    });

    it('excludes expired entries from size count', async () => {
      const mem = new SemanticMemory({ ttlMs: 100 });
      await mem.store('k', 'v');
      expect(mem.size).toBe(1);
      vi.advanceTimersByTime(200);
      expect(mem.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // maxEntries eviction
  // -------------------------------------------------------------------------

  describe('maxEntries eviction', () => {
    it('evicts the oldest entry when at capacity', async () => {
      const mem = new SemanticMemory({ maxEntries: 3 });
      await mem.store('a', 'alpha');
      await mem.store('b', 'beta');
      await mem.store('c', 'gamma');
      // Adding a 4th entry should evict 'a' (oldest)
      await mem.store('d', 'delta');
      expect(mem.size).toBe(3);
      expect(await mem.get('a')).toBeNull();
      expect(await mem.get('d')).not.toBeNull();
    });

    it('does not evict when overwriting an existing key', async () => {
      const mem = new SemanticMemory({ maxEntries: 2 });
      await mem.store('a', 'first');
      await mem.store('b', 'second');
      // Overwrite 'a' — should not evict 'b'
      await mem.store('a', 'updated');
      expect(mem.size).toBe(2);
      expect(await mem.get('b')).not.toBeNull();
    });
  });
});
