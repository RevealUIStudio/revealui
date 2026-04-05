/**
 * Rate Limit Store Tests
 *
 * Tests the RateLimitStore interface against both InMemoryRateLimitStore
 * and PGliteRateLimitStore. PGlite tests use in-memory mode.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RateLimitStore } from '../rate-limit-store.js';
import { InMemoryRateLimitStore } from '../rate-limit-store.js';

// =============================================================================
// Shared test suite — runs against any RateLimitStore implementation
// =============================================================================

function rateLimitStoreSuite(name: string, createStore: () => Promise<RateLimitStore>) {
  describe(name, () => {
    let store: RateLimitStore;

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

    it('stores and retrieves a window entry', async () => {
      await store.set('key1', { count: 5, windowStart: 1000 });
      const entry = await store.get('key1');
      expect(entry).toEqual({ count: 5, windowStart: 1000 });
    });

    it('overwrites existing key', async () => {
      await store.set('key', { count: 1, windowStart: 1000 });
      await store.set('key', { count: 10, windowStart: 2000 });
      const entry = await store.get('key');
      expect(entry).toEqual({ count: 10, windowStart: 2000 });
    });

    // ─── increment ────────────────────────────────────────────────────

    it('increments count for existing key', async () => {
      await store.set('inc', { count: 3, windowStart: 1000 });
      const newCount = await store.increment('inc');
      expect(newCount).toBe(4);

      const entry = await store.get('inc');
      expect(entry?.count).toBe(4);
    });

    it('returns 0 when incrementing non-existent key', async () => {
      const result = await store.increment('nope');
      expect(result).toBe(0);
    });

    // ─── cleanup ──────────────────────────────────────────────────────

    it('removes entries older than cutoff', async () => {
      await store.set('old', { count: 1, windowStart: 1000 });
      await store.set('new', { count: 1, windowStart: 5000 });

      const removed = await store.cleanup(3000);
      expect(removed).toBe(1);

      expect(await store.get('old')).toBeNull();
      expect(await store.get('new')).not.toBeNull();
    });

    it('returns 0 when nothing to clean up', async () => {
      await store.set('fresh', { count: 1, windowStart: 9000 });
      const removed = await store.cleanup(1000);
      expect(removed).toBe(0);
    });

    // ─── clear ────────────────────────────────────────────────────────

    it('clears all entries', async () => {
      await store.set('a', { count: 1, windowStart: 1000 });
      await store.set('b', { count: 2, windowStart: 2000 });
      await store.clear();

      expect(await store.get('a')).toBeNull();
      expect(await store.get('b')).toBeNull();
    });
  });
}

// =============================================================================
// Run suite against InMemoryRateLimitStore
// =============================================================================

rateLimitStoreSuite('InMemoryRateLimitStore', async () => new InMemoryRateLimitStore());

// =============================================================================
// Run suite against PGliteRateLimitStore (if @electric-sql/pglite is available)
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
  const { PGliteRateLimitStore } = await import('../rate-limit-store.js');

  // Share a single PGlite instance across all PGlite tests to avoid
  // repeated ~3-5s init overhead that causes CI timeouts.
  const sharedDb = new PGlite();

  afterAll(async () => {
    await sharedDb.close();
  });

  rateLimitStoreSuite('PGliteRateLimitStore', async () => {
    const store = new PGliteRateLimitStore({ db: sharedDb, closeOnDestroy: false });
    await store.clear();
    return store;
  });

  describe('PGliteRateLimitStore — SQL-specific', () => {
    it('handles special characters in keys', async () => {
      const store = new PGliteRateLimitStore({ db: sharedDb, closeOnDestroy: false });
      await store.set('key\'with"quotes', { count: 1, windowStart: 1000 });
      const entry = await store.get('key\'with"quotes');
      expect(entry).toEqual({ count: 1, windowStart: 1000 });
      await store.close();
    });

    it('persists across operations without losing data', async () => {
      const store = new PGliteRateLimitStore({ db: sharedDb, closeOnDestroy: false });

      await store.set('t1:free', { count: 10, windowStart: 1000 });
      await store.set('t2:pro', { count: 50, windowStart: 2000 });
      await store.increment('t1:free');

      expect(await store.get('t1:free')).toEqual({ count: 11, windowStart: 1000 });
      expect(await store.get('t2:pro')).toEqual({ count: 50, windowStart: 2000 });
      await store.close();
    });
  });
} else {
  describe.skip('PGliteRateLimitStore (skipped — @electric-sql/pglite not available)', () => {
    it('placeholder', () => {});
  });
}
