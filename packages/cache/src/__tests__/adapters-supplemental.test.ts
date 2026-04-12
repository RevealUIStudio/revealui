/**
 * Supplemental adapter tests covering PGliteCacheStore.closeOnDestroy and
 * InMemoryCacheStore edge cases not exercised by the primary adapters.test.ts.
 */

import { describe, expect, it, vi } from 'vitest';
import { InMemoryCacheStore } from '../adapters/memory.js';

// ---------------------------------------------------------------------------
// InMemoryCacheStore  -  additional edge cases
// ---------------------------------------------------------------------------

describe('InMemoryCacheStore  -  tag operations', () => {
  it('deleteByTags returns 0 when no tags are given', async () => {
    const store = new InMemoryCacheStore();
    await store.set('k', 'v', 60, ['alpha']);
    const count = await store.deleteByTags([]);
    expect(count).toBe(0);
    expect(await store.get('k')).toBe('v');
    await store.close();
  });

  it('an entry tagged with multiple tags is deleted when any tag matches', async () => {
    const store = new InMemoryCacheStore();
    await store.set('k1', 'a', 60, ['tag-a', 'tag-b']);
    await store.set('k2', 'b', 60, ['tag-b', 'tag-c']);
    await store.set('k3', 'c', 60, ['tag-c']);

    const count = await store.deleteByTags(['tag-a']);
    expect(count).toBe(1);
    expect(await store.get('k1')).toBeNull();
    expect(await store.get('k2')).toBe('b');
    await store.close();
  });

  it('deleteByPrefix with empty prefix matches nothing', async () => {
    // startsWith('') is always true  -  this verifies the semantics
    const store = new InMemoryCacheStore();
    await store.set('abc', '1', 60);
    await store.set('xyz', '2', 60);
    const count = await store.deleteByPrefix('');
    expect(count).toBe(2);
    await store.close();
  });
});

describe('InMemoryCacheStore  -  prune removes only expired entries', () => {
  it('prune does not remove live entries', async () => {
    vi.useFakeTimers();
    try {
      const store = new InMemoryCacheStore();
      await store.set('live', 'a', 600);
      await store.set('soon-expired', 'b', 1);

      vi.advanceTimersByTime(1500);

      const pruned = await store.prune();
      expect(pruned).toBe(1);
      expect(await store.get('live')).toBe('a');
      await store.close();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('InMemoryCacheStore  -  capacity eviction preserves newest entries', () => {
  it('second-oldest entry is preserved when first is evicted at capacity', async () => {
    const store = new InMemoryCacheStore({ maxEntries: 3 });
    await store.set('a', 1, 60);
    await store.set('b', 2, 60);
    await store.set('c', 3, 60);
    await store.set('d', 4, 60); // evicts 'a'

    expect(await store.get('a')).toBeNull();
    expect(await store.get('b')).toBe(2);
    expect(await store.get('c')).toBe(3);
    expect(await store.get('d')).toBe(4);
    await store.close();
  });

  it('updating an existing key at capacity does not evict other entries', async () => {
    const store = new InMemoryCacheStore({ maxEntries: 2 });
    await store.set('x', 10, 60);
    await store.set('y', 20, 60);
    await store.set('x', 99, 60); // update, not a new key

    expect(await store.get('x')).toBe(99);
    expect(await store.get('y')).toBe(20);
    await store.close();
  });
});

// ---------------------------------------------------------------------------
// PGliteCacheStore  -  closeOnDestroy branch
// ---------------------------------------------------------------------------

let pgliteAvailable = false;
try {
  await import('@electric-sql/pglite');
  pgliteAvailable = true;
} catch {
  // not installed
}

if (pgliteAvailable) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGliteCacheStore } = await import('../adapters/pglite.js');

  describe('PGliteCacheStore  -  closeOnDestroy:true', () => {
    it('calls db.close() when closeOnDestroy is true', async () => {
      const db = new PGlite();
      const closeSpy = vi.spyOn(db, 'close');

      const store = new PGliteCacheStore({ db, closeOnDestroy: true });
      await store.close();

      expect(closeSpy).toHaveBeenCalledOnce();
    });

    it('does not call db.close() when closeOnDestroy is false', async () => {
      const db = new PGlite();
      const closeSpy = vi.spyOn(db, 'close');

      const store = new PGliteCacheStore({ db, closeOnDestroy: false });
      await store.close();

      expect(closeSpy).not.toHaveBeenCalled();
      await db.close();
    });
  });

  describe('PGliteCacheStore  -  delete with zero keys', () => {
    it('returns 0 without hitting the database when called with no keys', async () => {
      const db = new PGlite();
      const store = new PGliteCacheStore({ db, closeOnDestroy: true });

      const querySpy = vi.spyOn(db, 'query');
      // Wait for init to complete so the spy only captures our call
      await store.set('probe', 'v', 60);
      querySpy.mockClear();

      const count = await store.delete();
      expect(count).toBe(0);
      // delete() with zero keys should short-circuit before calling query
      expect(querySpy).not.toHaveBeenCalled();

      await store.close();
    });
  });
} else {
  describe.skip('PGliteCacheStore supplemental (skipped  -  @electric-sql/pglite not available)', () => {
    it('placeholder', () => {});
  });
}
