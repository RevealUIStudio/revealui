/**
 * Cache Invalidation Channel Tests
 *
 * Tests the distributed cache invalidation mechanism using PGlite
 * in-memory mode to simulate two instances sharing events via a database table.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryCacheStore } from '../adapters/memory.js';
import { CacheInvalidationChannel } from '../invalidation-channel.js';

// Skip if PGlite is not available
let pgliteAvailable = false;
try {
  await import('@electric-sql/pglite');
  pgliteAvailable = true;
} catch {
  // PGlite not installed
}

if (pgliteAvailable) {
  const { PGlite } = await import('@electric-sql/pglite');

  // Share a single PGlite instance across all tests to avoid
  // repeated ~3-5s init overhead that causes CI timeouts.
  const sharedDb = new PGlite();

  afterAll(async () => {
    await sharedDb.close();
  });

  describe('CacheInvalidationChannel', () => {
    let storeA: InMemoryCacheStore;
    let storeB: InMemoryCacheStore;
    let channelA: CacheInvalidationChannel;
    let channelB: CacheInvalidationChannel;

    beforeEach(async () => {
      // Clear events table from previous tests
      await sharedDb.exec('DELETE FROM _cache_invalidation_events').catch(() => {
        // Table may not exist yet on first run  -  init will create it
      });

      // Two cache stores (simulating two server instances)
      storeA = new InMemoryCacheStore();
      storeB = new InMemoryCacheStore();

      // Two channels on the same DB, different instance IDs
      channelA = new CacheInvalidationChannel(sharedDb, storeA, {
        instanceId: 'instance-a',
        pollIntervalMs: 100,
        eventTtlSeconds: 30,
      });
      channelB = new CacheInvalidationChannel(sharedDb, storeB, {
        instanceId: 'instance-b',
        pollIntervalMs: 100,
        eventTtlSeconds: 30,
      });
    });

    afterEach(async () => {
      await channelA.close();
      await channelB.close();
      await storeA.close();
      await storeB.close();
    });

    // ─── Key deletion ───────────────────────────────────────────────────

    it('propagates key deletion from A to B', async () => {
      // Both instances have cached data
      await storeA.set('shared-key', 'value-a', 60);
      await storeB.set('shared-key', 'value-b', 60);

      // Instance A deletes and publishes
      await storeA.delete('shared-key');
      await channelA.publishDelete('shared-key');

      // Instance B polls and applies
      const applied = await channelB.poll();
      expect(applied).toBe(1);
      expect(await storeB.get('shared-key')).toBeNull();
    });

    it('does not apply own events', async () => {
      await storeA.set('my-key', 'value', 60);

      await channelA.publishDelete('my-key');

      // Same instance polls  -  should skip its own event
      const applied = await channelA.poll();
      expect(applied).toBe(0);
      // Key was manually deleted before publish, but store still has it
      // since publish doesn't delete locally
    });

    it('handles multiple key deletions', async () => {
      await storeB.set('k1', '1', 60);
      await storeB.set('k2', '2', 60);
      await storeB.set('k3', '3', 60);

      await channelA.publishDelete('k1', 'k3');

      const applied = await channelB.poll();
      expect(applied).toBe(1);
      expect(await storeB.get('k1')).toBeNull();
      expect(await storeB.get('k2')).toBe('2');
      expect(await storeB.get('k3')).toBeNull();
    });

    // ─── Prefix deletion ────────────────────────────────────────────────

    it('propagates prefix deletion', async () => {
      await storeB.set('user:1:profile', 'alice', 60);
      await storeB.set('user:2:profile', 'bob', 60);
      await storeB.set('post:1', 'hello', 60);

      await channelA.publishDeletePrefix('user:');

      const applied = await channelB.poll();
      expect(applied).toBe(1);
      expect(await storeB.get('user:1:profile')).toBeNull();
      expect(await storeB.get('user:2:profile')).toBeNull();
      expect(await storeB.get('post:1')).toBe('hello');
    });

    // ─── Tag deletion ───────────────────────────────────────────────────

    it('propagates tag-based deletion', async () => {
      await storeB.set('p1', 'a', 60, ['posts', 'user:1']);
      await storeB.set('p2', 'b', 60, ['posts', 'user:2']);
      await storeB.set('c1', 'c', 60, ['comments']);

      await channelA.publishDeleteTags(['posts']);

      const applied = await channelB.poll();
      expect(applied).toBe(1);
      expect(await storeB.get('p1')).toBeNull();
      expect(await storeB.get('p2')).toBeNull();
      expect(await storeB.get('c1')).toBe('c');
    });

    // ─── Clear ──────────────────────────────────────────────────────────

    it('propagates clear-all event', async () => {
      await storeB.set('a', '1', 60);
      await storeB.set('b', '2', 60);

      await channelA.publishClear();

      const applied = await channelB.poll();
      expect(applied).toBe(1);
      expect(await storeB.size()).toBe(0);
    });

    // ─── Ordering ───────────────────────────────────────────────────────

    it('applies events in order', async () => {
      await storeB.set('x', '1', 60);
      await storeB.set('y', '2', 60);

      await channelA.publishDelete('x');
      await channelA.publishDelete('y');

      const applied = await channelB.poll();
      expect(applied).toBe(2);
      expect(await storeB.get('x')).toBeNull();
      expect(await storeB.get('y')).toBeNull();
    });

    it('does not re-apply previously seen events', async () => {
      await storeB.set('k', 'v', 60);
      await channelA.publishDelete('k');

      // First poll
      await channelB.poll();
      expect(await storeB.get('k')).toBeNull();

      // Re-add the key
      await storeB.set('k', 'v2', 60);

      // Second poll  -  should NOT delete again (already seen)
      const applied = await channelB.poll();
      expect(applied).toBe(0);
      expect(await storeB.get('k')).toBe('v2');
    });

    // ─── Pruning ────────────────────────────────────────────────────────

    it('prunes old events during poll', async () => {
      vi.useFakeTimers();
      try {
        await channelA.publishDelete('old-key');

        // Advance past event TTL
        vi.advanceTimersByTime(31_000);

        // Poll triggers prune  -  event should be removed
        await channelB.poll();

        // Verify table is empty by checking a fresh channel
        const freshStore = new InMemoryCacheStore();
        const freshChannel = new CacheInvalidationChannel(sharedDb, freshStore, {
          instanceId: 'instance-c',
          pollIntervalMs: 1000,
          eventTtlSeconds: 30,
        });
        // Set lastSeen to 0 to see all events
        const applied = await freshChannel.poll();
        // Old event was pruned, so nothing to apply
        expect(applied).toBe(0);
        await freshChannel.close();
        await freshStore.close();
      } finally {
        vi.useRealTimers();
      }
    });
  });
} else {
  describe.skip('CacheInvalidationChannel (skipped  -  @electric-sql/pglite not available)', () => {
    it('placeholder', () => {});
  });
}
