/**
 * Cache Store Adapter Tests
 *
 * Tests the CacheStore interface against both InMemoryCacheStore and PGliteCacheStore.
 * PGlite tests use in-memory mode — no external database required.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryCacheStore } from '../adapters/memory.js';
import type { CacheStore } from '../adapters/types.js';

// =============================================================================
// Shared test suite — runs against any CacheStore implementation
// =============================================================================

function cacheStoreSuite(name: string, createStore: () => Promise<CacheStore>) {
  describe(name, () => {
    let store: CacheStore;

    beforeEach(async () => {
      store = await createStore();
    });

    afterEach(async () => {
      await store.close();
    });

    // ─── get / set ─────────────────────────────────────────────────────

    it('returns null for missing key', async () => {
      expect(await store.get('missing')).toBeNull();
    });

    it('stores and retrieves a string value', async () => {
      await store.set('key1', 'hello', 60);
      expect(await store.get('key1')).toBe('hello');
    });

    it('stores and retrieves an object value', async () => {
      const obj = { name: 'test', count: 42, nested: { ok: true } };
      await store.set('obj', obj, 60);
      expect(await store.get('obj')).toEqual(obj);
    });

    it('stores and retrieves an array value', async () => {
      const arr = [1, 'two', { three: 3 }];
      await store.set('arr', arr, 60);
      expect(await store.get('arr')).toEqual(arr);
    });

    it('overwrites existing key', async () => {
      await store.set('key', 'v1', 60);
      await store.set('key', 'v2', 60);
      expect(await store.get('key')).toBe('v2');
    });

    // ─── TTL / expiry ──────────────────────────────────────────────────

    it('returns null for expired entry', async () => {
      vi.useFakeTimers();
      try {
        await store.set('expire-me', 'val', 1); // 1 second TTL
        expect(await store.get('expire-me')).toBe('val');

        vi.advanceTimersByTime(1500); // advance past TTL
        expect(await store.get('expire-me')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    // ─── delete ────────────────────────────────────────────────────────

    it('deletes a single key', async () => {
      await store.set('d1', 'val', 60);
      const count = await store.delete('d1');
      expect(count).toBe(1);
      expect(await store.get('d1')).toBeNull();
    });

    it('returns 0 when deleting non-existent key', async () => {
      expect(await store.delete('nope')).toBe(0);
    });

    it('deletes multiple keys', async () => {
      await store.set('m1', 'a', 60);
      await store.set('m2', 'b', 60);
      await store.set('m3', 'c', 60);
      const count = await store.delete('m1', 'm3');
      expect(count).toBe(2);
      expect(await store.get('m2')).toBe('b');
    });

    // ─── deleteByPrefix ────────────────────────────────────────────────

    it('deletes entries by prefix', async () => {
      await store.set('user:1', 'alice', 60);
      await store.set('user:2', 'bob', 60);
      await store.set('post:1', 'hello', 60);
      const count = await store.deleteByPrefix('user:');
      expect(count).toBe(2);
      expect(await store.get('post:1')).toBe('hello');
    });

    it('returns 0 when no entries match prefix', async () => {
      await store.set('a', '1', 60);
      expect(await store.deleteByPrefix('z:')).toBe(0);
    });

    // ─── deleteByTags ──────────────────────────────────────────────────

    it('deletes entries by tags', async () => {
      await store.set('t1', 'a', 60, ['posts', 'user:1']);
      await store.set('t2', 'b', 60, ['posts', 'user:2']);
      await store.set('t3', 'c', 60, ['comments']);
      const count = await store.deleteByTags(['posts']);
      expect(count).toBe(2);
      expect(await store.get('t3')).toBe('c');
    });

    it('returns 0 when no entries match tags', async () => {
      await store.set('x', '1', 60, ['alpha']);
      expect(await store.deleteByTags(['beta'])).toBe(0);
    });

    // ─── clear ─────────────────────────────────────────────────────────

    it('clears all entries', async () => {
      await store.set('c1', 'a', 60);
      await store.set('c2', 'b', 60);
      await store.clear();
      expect(await store.size()).toBe(0);
    });

    // ─── size ──────────────────────────────────────────────────────────

    it('reports correct size', async () => {
      expect(await store.size()).toBe(0);
      await store.set('s1', 'a', 60);
      await store.set('s2', 'b', 60);
      expect(await store.size()).toBe(2);
    });

    it('excludes expired entries from size', async () => {
      vi.useFakeTimers();
      try {
        await store.set('live', 'a', 60);
        await store.set('dead', 'b', 1);
        vi.advanceTimersByTime(1500);
        expect(await store.size()).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    // ─── prune ─────────────────────────────────────────────────────────

    it('prunes expired entries', async () => {
      vi.useFakeTimers();
      try {
        await store.set('p1', 'a', 1);
        await store.set('p2', 'b', 1);
        await store.set('p3', 'c', 600);
        vi.advanceTimersByTime(1500);

        const pruned = await store.prune();
        expect(pruned).toBe(2);
        expect(await store.get('p3')).toBe('c');
      } finally {
        vi.useRealTimers();
      }
    });
  });
}

// =============================================================================
// Run suite against InMemoryCacheStore
// =============================================================================

cacheStoreSuite('InMemoryCacheStore', async () => new InMemoryCacheStore());

// =============================================================================
// InMemory-specific tests
// =============================================================================

describe('InMemoryCacheStore — capacity eviction', () => {
  it('evicts oldest entry when at maxEntries', async () => {
    const store = new InMemoryCacheStore({ maxEntries: 2 });
    await store.set('a', 1, 60);
    await store.set('b', 2, 60);
    await store.set('c', 3, 60); // should evict 'a'
    expect(await store.get('a')).toBeNull();
    expect(await store.get('b')).toBe(2);
    expect(await store.get('c')).toBe(3);
    await store.close();
  });
});

// =============================================================================
// Run suite against PGliteCacheStore (if @electric-sql/pglite is available)
// =============================================================================

let pgliteAvailable = false;
try {
  await import('@electric-sql/pglite');
  pgliteAvailable = true;
} catch {
  // PGlite not installed — skip
}

if (pgliteAvailable) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGliteCacheStore } = await import('../adapters/pglite.js');

  // Share a single PGlite instance across all PGlite tests to avoid
  // repeated ~3-5s init overhead that causes CI timeouts.
  const sharedDb = new PGlite();

  afterAll(async () => {
    await sharedDb.close();
  });

  cacheStoreSuite('PGliteCacheStore', async () => {
    const store = new PGliteCacheStore({ db: sharedDb, closeOnDestroy: false });
    await store.clear();
    return store;
  });

  describe('PGliteCacheStore — SQL-specific', () => {
    it('handles special characters in keys', async () => {
      const store = new PGliteCacheStore({ db: sharedDb, closeOnDestroy: false });
      await store.set('key\'with"quotes', 'val', 60);
      expect(await store.get('key\'with"quotes')).toBe('val');
      await store.close();
    });

    it('handles LIKE wildcards in deleteByPrefix safely', async () => {
      const store = new PGliteCacheStore({ db: sharedDb, closeOnDestroy: false });
      await store.clear();
      await store.set('100%_done', 'a', 60);
      await store.set('100_other', 'b', 60);
      // Should only delete the key starting with '100%_'
      const count = await store.deleteByPrefix('100%_');
      expect(count).toBe(1);
      expect(await store.get('100_other')).toBe('b');
      await store.close();
    });

    it('handles backslashes in deleteByPrefix safely', async () => {
      const store = new PGliteCacheStore({ db: sharedDb, closeOnDestroy: false });
      await store.clear();
      await store.set('path\\to\\file:1', 'a', 60);
      await store.set('path\\to\\file:2', 'b', 60);
      await store.set('path\\other', 'c', 60);
      const count = await store.deleteByPrefix('path\\to\\file:');
      expect(count).toBe(2);
      expect(await store.get('path\\other')).toBe('c');
      await store.close();
    });
  });
} else {
  describe.skip('PGliteCacheStore (skipped — @electric-sql/pglite not available)', () => {
    it('placeholder', () => {});
  });
}
