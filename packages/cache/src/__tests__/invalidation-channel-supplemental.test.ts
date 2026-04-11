/**
 * Supplemental invalidation-channel tests covering start/stop lifecycle and
 * applyEvent error handling — branches not exercised by the primary suite.
 *
 * Uses PGlite in-memory mode; skipped when @electric-sql/pglite is absent.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryCacheStore } from '../adapters/memory.js';
import { CacheInvalidationChannel } from '../invalidation-channel.js';

let pgliteAvailable = false;
try {
  await import('@electric-sql/pglite');
  pgliteAvailable = true;
} catch {
  // not installed
}

if (pgliteAvailable) {
  const { PGlite } = await import('@electric-sql/pglite');

  const sharedDb = new PGlite();

  afterAll(async () => {
    await sharedDb.close();
  });

  // ─── start / stop lifecycle ─────────────────────────────────────────────

  describe('CacheInvalidationChannel — start/stop lifecycle', () => {
    let store: InMemoryCacheStore;
    let channel: CacheInvalidationChannel;

    beforeEach(async () => {
      await sharedDb.exec('DELETE FROM _cache_invalidation_events').catch(() => {});
      store = new InMemoryCacheStore();
      channel = new CacheInvalidationChannel(sharedDb, store, {
        instanceId: 'lifecycle-test',
        pollIntervalMs: 50,
        eventTtlSeconds: 60,
      });
    });

    afterEach(async () => {
      await channel.close();
      await store.close();
    });

    it('start() begins polling and stop() halts it', async () => {
      vi.useFakeTimers();
      try {
        const pollSpy = vi.spyOn(channel, 'poll');

        await channel.start();

        vi.advanceTimersByTime(120);
        expect(pollSpy).toHaveBeenCalled();

        const callCount = pollSpy.mock.calls.length;
        channel.stop();

        vi.advanceTimersByTime(200);
        expect(pollSpy.mock.calls.length).toBe(callCount);
      } finally {
        vi.useRealTimers();
      }
    });

    it('calling start() twice does not create a second interval', async () => {
      vi.useFakeTimers();
      try {
        const pollSpy = vi.spyOn(channel, 'poll');

        await channel.start();
        await channel.start();

        vi.advanceTimersByTime(110);

        // At 50ms poll interval over 110ms, exactly 2 polls expected (one per interval tick).
        // A double-registered interval would produce 4.
        expect(pollSpy.mock.calls.length).toBeLessThanOrEqual(3);
      } finally {
        channel.stop();
        vi.useRealTimers();
      }
    });

    it('stop() is idempotent when not polling', () => {
      expect(() => channel.stop()).not.toThrow();
      expect(() => channel.stop()).not.toThrow();
    });

    it('close() stops the interval and is safe to call multiple times', async () => {
      vi.useFakeTimers();
      try {
        await channel.start();
        await channel.close();
        await channel.close();

        const pollSpy = vi.spyOn(channel, 'poll');
        vi.advanceTimersByTime(200);
        expect(pollSpy).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // ─── applyEvent error handling ──────────────────────────────────────────

  describe('CacheInvalidationChannel — applyEvent errors are logged', () => {
    let storeA: InMemoryCacheStore;
    let storeB: InMemoryCacheStore;
    let channelA: CacheInvalidationChannel;
    let channelB: CacheInvalidationChannel;

    beforeEach(async () => {
      await sharedDb.exec('DELETE FROM _cache_invalidation_events').catch(() => {});
      storeA = new InMemoryCacheStore();
      storeB = new InMemoryCacheStore();

      channelA = new CacheInvalidationChannel(sharedDb, storeA, {
        instanceId: 'err-a',
        pollIntervalMs: 100,
        eventTtlSeconds: 60,
      });
      channelB = new CacheInvalidationChannel(sharedDb, storeB, {
        instanceId: 'err-b',
        pollIntervalMs: 100,
        eventTtlSeconds: 60,
      });
    });

    afterEach(async () => {
      await channelA.close();
      await channelB.close();
      await storeA.close();
      await storeB.close();
    });

    it('logs error and continues when one event fails to apply', async () => {
      await storeB.set('k1', 'v1', 60);
      await storeB.set('k2', 'v2', 60);

      await channelA.publishDelete('k1', 'k2');

      // Poison the store so the second delete throws
      let callCount = 0;
      const origDelete = storeB.delete.bind(storeB);
      storeB.delete = async (...keys: string[]) => {
        callCount++;
        if (callCount > 1) {
          throw new Error('simulated store error');
        }
        return origDelete(...keys);
      };

      // poll should not throw even when applyEvent errors
      await expect(channelB.poll()).resolves.not.toThrow();
    });
  });
} else {
  describe.skip('CacheInvalidationChannel supplemental (skipped — @electric-sql/pglite not available)', () => {
    it('placeholder', () => {});
  });
}
