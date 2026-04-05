/**
 * Circuit Breaker Store Tests
 *
 * Tests the CircuitBreakerStore interface against both InMemoryCircuitBreakerStore
 * and PGliteCircuitBreakerStore. PGlite tests use in-memory mode.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CircuitBreakerSnapshot, CircuitBreakerStore } from '../circuit-breaker-store.js';
import { InMemoryCircuitBreakerStore } from '../circuit-breaker-store.js';

const SAMPLE_SNAPSHOT: CircuitBreakerSnapshot = {
  state: 'closed',
  failureCount: 3,
  successCount: 10,
  consecutiveFailures: 1,
  consecutiveSuccesses: 0,
  lastFailureAt: 1000,
  lastSuccessAt: 2000,
  stateChangedAt: 500,
};

// =============================================================================
// Shared test suite — runs against any CircuitBreakerStore implementation
// =============================================================================

function circuitBreakerStoreSuite(name: string, createStore: () => Promise<CircuitBreakerStore>) {
  describe(name, () => {
    let store: CircuitBreakerStore;

    beforeEach(async () => {
      store = await createStore();
    });

    afterEach(async () => {
      await store.close();
    });

    // ─── load / save ────────────────────────────────────────────────────

    it('returns null for unknown service', async () => {
      expect(await store.load('unknown')).toBeNull();
    });

    it('saves and loads a snapshot', async () => {
      await store.save('stripe', SAMPLE_SNAPSHOT);
      const loaded = await store.load('stripe');
      expect(loaded).toEqual(SAMPLE_SNAPSHOT);
    });

    it('overwrites existing snapshot', async () => {
      await store.save('stripe', SAMPLE_SNAPSHOT);
      const updated: CircuitBreakerSnapshot = {
        ...SAMPLE_SNAPSHOT,
        state: 'open',
        failureCount: 5,
        stateChangedAt: 3000,
      };
      await store.save('stripe', updated);
      const loaded = await store.load('stripe');
      expect(loaded).toEqual(updated);
    });

    it('stores services independently', async () => {
      await store.save('stripe', SAMPLE_SNAPSHOT);
      const neonSnapshot: CircuitBreakerSnapshot = {
        ...SAMPLE_SNAPSHOT,
        state: 'half-open',
        failureCount: 10,
      };
      await store.save('neon', neonSnapshot);

      expect(await store.load('stripe')).toEqual(SAMPLE_SNAPSHOT);
      expect(await store.load('neon')).toEqual(neonSnapshot);
    });

    // ─── state values ───────────────────────────────────────────────────

    it('persists all circuit states', async () => {
      for (const state of ['closed', 'open', 'half-open'] as const) {
        await store.save(`svc-${state}`, { ...SAMPLE_SNAPSHOT, state });
        const loaded = await store.load(`svc-${state}`);
        expect(loaded?.state).toBe(state);
      }
    });

    // ─── remove ─────────────────────────────────────────────────────────

    it('removes an existing service', async () => {
      await store.save('stripe', SAMPLE_SNAPSHOT);
      const removed = await store.remove('stripe');
      expect(removed).toBe(true);
      expect(await store.load('stripe')).toBeNull();
    });

    it('returns false when removing non-existent service', async () => {
      expect(await store.remove('nope')).toBe(false);
    });

    // ─── clear ──────────────────────────────────────────────────────────

    it('clears all services', async () => {
      await store.save('s1', SAMPLE_SNAPSHOT);
      await store.save('s2', SAMPLE_SNAPSHOT);
      await store.clear();
      expect(await store.load('s1')).toBeNull();
      expect(await store.load('s2')).toBeNull();
    });
  });
}

// =============================================================================
// Run suite against InMemoryCircuitBreakerStore
// =============================================================================

circuitBreakerStoreSuite(
  'InMemoryCircuitBreakerStore',
  async () => new InMemoryCircuitBreakerStore(),
);

// =============================================================================
// Run suite against PGliteCircuitBreakerStore (if @electric-sql/pglite available)
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
  const { PGliteCircuitBreakerStore } = await import('../circuit-breaker-store.js');

  circuitBreakerStoreSuite('PGliteCircuitBreakerStore', async () => {
    const db = new PGlite();
    return new PGliteCircuitBreakerStore({ db, closeOnDestroy: true });
  });

  describe('PGliteCircuitBreakerStore — SQL-specific', () => {
    it('handles special characters in service names', async () => {
      const db = new PGlite();
      const store = new PGliteCircuitBreakerStore({ db, closeOnDestroy: true });
      await store.save('svc\'with"quotes', SAMPLE_SNAPSHOT);
      const loaded = await store.load('svc\'with"quotes');
      expect(loaded).toEqual(SAMPLE_SNAPSHOT);
      await store.close();
    });

    it('handles large counter values', async () => {
      const db = new PGlite();
      const store = new PGliteCircuitBreakerStore({ db, closeOnDestroy: true });
      const bigSnapshot: CircuitBreakerSnapshot = {
        state: 'closed',
        failureCount: 1_000_000,
        successCount: 5_000_000,
        consecutiveFailures: 0,
        consecutiveSuccesses: 100,
        lastFailureAt: Date.now() - 86_400_000,
        lastSuccessAt: Date.now(),
        stateChangedAt: Date.now() - 3_600_000,
      };
      await store.save('high-traffic', bigSnapshot);
      const loaded = await store.load('high-traffic');
      expect(loaded).toEqual(bigSnapshot);
      await store.close();
    });
  });
} else {
  describe.skip('PGliteCircuitBreakerStore (skipped — @electric-sql/pglite not available)', () => {
    it('placeholder', () => {});
  });
}
