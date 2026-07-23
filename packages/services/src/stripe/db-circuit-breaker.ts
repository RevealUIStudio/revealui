/**
 * DB-Backed Circuit Breaker
 *
 * Shared multi-instance circuit for Stripe (and similar) operations.
 *
 * Architecture (fleet-redundancy P2-D):
 *   - State machine thresholds align with `@revealui/resilience` CircuitBreaker
 *   - Durable state via CircuitBreakerStore (default: NeonCircuitBreakerStore)
 *   - Local in-memory cache (5s TTL) — fast read path, no store hit per request
 *   - Store write only on state transitions (open/closed/half-open changes)
 *   - Fail-open on store errors: if we can't read state, we let the call through
 *     rather than blocking all traffic because the circuit state store is down
 */

import { createLogger } from '@revealui/core/observability/logger';
import type {
  CircuitBreakerSnapshot,
  CircuitBreakerStore,
  CircuitState,
} from '@revealui/resilience';
import { NeonCircuitBreakerStore } from './neon-circuit-breaker-store.js';

const logger = createLogger({ service: 'DbCircuitBreaker' });

interface CachedState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt: number; // Unix ms, 0 = never
  stateChangedAt: number; // Unix ms
  cachedAt: number; // Unix ms
}

export interface DbCircuitBreakerConfig {
  /** Number of consecutive failures before tripping. Default: 5 */
  failureThreshold: number;
  /** Consecutive successes in half-open to close the circuit. Default: 2 */
  successThreshold: number;
  /** Milliseconds to wait in open state before probing. Default: 30_000 */
  resetTimeout: number;
  /** Local cache TTL in milliseconds. Default: 5_000 */
  cacheTtlMs: number;
}

const DEFAULT_CONFIG: DbCircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeout: 30_000,
  cacheTtlMs: 5_000,
};

// Module-level cache shared across all instances in the same process
const localCache = new Map<string, CachedState>();

const defaultStore: CircuitBreakerStore = new NeonCircuitBreakerStore();

function toSnapshot(s: CachedState): CircuitBreakerSnapshot {
  return {
    state: s.state,
    failureCount: s.failureCount,
    successCount: s.successCount,
    consecutiveFailures: s.failureCount,
    consecutiveSuccesses: s.successCount,
    lastFailureAt: s.lastFailureAt,
    lastSuccessAt: 0,
    stateChangedAt: s.stateChangedAt,
  };
}

function fromSnapshot(snap: CircuitBreakerSnapshot): CachedState {
  return {
    state: snap.state,
    failureCount: snap.consecutiveFailures || snap.failureCount,
    successCount: snap.consecutiveSuccesses || snap.successCount,
    lastFailureAt: snap.lastFailureAt,
    stateChangedAt: snap.stateChangedAt,
    cachedAt: Date.now(),
  };
}

export class DbCircuitBreaker {
  private readonly config: DbCircuitBreakerConfig;
  private readonly store: CircuitBreakerStore;

  constructor(
    private readonly serviceName: string,
    config: Partial<DbCircuitBreakerConfig> = {},
    store: CircuitBreakerStore = defaultStore,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = store;
  }

  /**
   * Returns true if the circuit is open (requests should be blocked).
   * Automatically transitions open→half-open when resetTimeout elapses.
   */
  async isOpen(): Promise<boolean> {
    const s = await this.readState();

    if (s.state === 'closed') return false;

    if (s.state === 'half-open') return false;

    // state === 'open'
    if (Date.now() - s.stateChangedAt >= this.config.resetTimeout) {
      // Probe window: transition to half-open and allow one request through
      await this.writeState({
        ...s,
        state: 'half-open',
        successCount: 0,
        stateChangedAt: Date.now(),
      });
      return false;
    }

    return true;
  }

  /**
   * Record a successful call. Closes the circuit if enough successes in half-open.
   */
  async recordSuccess(): Promise<void> {
    const s = await this.readState();

    if (s.state === 'half-open') {
      const newSuccesses = s.successCount + 1;
      if (newSuccesses >= this.config.successThreshold) {
        await this.writeState({
          ...s,
          state: 'closed',
          failureCount: 0,
          successCount: 0,
          stateChangedAt: Date.now(),
        });
      } else {
        // Update local cache only  -  no store write until threshold is reached
        localCache.set(this.serviceName, {
          ...s,
          successCount: newSuccesses,
          cachedAt: s.cachedAt,
        });
      }
      return;
    }

    if (s.state === 'closed' && s.failureCount > 0) {
      // Reset sub-threshold failure counter locally (no store write needed)
      localCache.set(this.serviceName, { ...s, failureCount: 0 });
    }
  }

  /**
   * Record a failed call. Trips the circuit when the failure threshold is reached.
   */
  async recordFailure(): Promise<void> {
    const s = await this.readState();
    const newFailures = s.failureCount + 1;

    if (s.state === 'half-open' || newFailures >= this.config.failureThreshold) {
      // Trip or re-trip the circuit
      await this.writeState({
        ...s,
        state: 'open',
        failureCount: newFailures,
        successCount: 0,
        lastFailureAt: Date.now(),
        stateChangedAt: Date.now(),
      });
    } else {
      // Sub-threshold: update local counter without hitting the store
      localCache.set(this.serviceName, {
        ...s,
        failureCount: newFailures,
        lastFailureAt: Date.now(),
        cachedAt: s.cachedAt,
      });
    }
  }

  /** Force-reset state and clear local cache. Primarily for testing. */
  async reset(): Promise<void> {
    const fresh: CachedState = {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureAt: 0,
      stateChangedAt: Date.now(),
      cachedAt: Date.now(),
    };
    await this.writeState(fresh);
  }

  /** Clear only the local cache (forces next read to hit the store). For testing. */
  clearLocalCache(): void {
    localCache.delete(this.serviceName);
  }

  // ---------------------------------------------------------------------------

  private async readState(): Promise<CachedState> {
    const cached = localCache.get(this.serviceName);
    if (cached && Date.now() - cached.cachedAt < this.config.cacheTtlMs) {
      return cached;
    }
    return this.readFromStore();
  }

  private async readFromStore(): Promise<CachedState> {
    try {
      const snap = await this.store.load(this.serviceName);
      const state: CachedState = snap
        ? fromSnapshot(snap)
        : {
            state: 'closed',
            failureCount: 0,
            successCount: 0,
            lastFailureAt: 0,
            stateChangedAt: Date.now(),
            cachedAt: Date.now(),
          };

      localCache.set(this.serviceName, state);
      return state;
    } catch {
      // Fail-open: if the store is unreachable, default to closed so Stripe
      // calls proceed. Log a warning but do not block traffic.
      logger.warn(
        `DbCircuitBreaker: failed to read state for '${this.serviceName}', defaulting to closed`,
      );
      const fallback: CachedState = {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        lastFailureAt: 0,
        stateChangedAt: Date.now(),
        cachedAt: Date.now(),
      };
      localCache.set(this.serviceName, fallback);
      return fallback;
    }
  }

  private async writeState(s: CachedState): Promise<void> {
    // Optimistically update local cache first so subsequent in-process
    // calls see the new state without waiting for the store round-trip.
    localCache.set(this.serviceName, { ...s, cachedAt: Date.now() });

    try {
      await this.store.save(this.serviceName, toSnapshot(s));
    } catch (err) {
      // Non-fatal: local cache has the new state; store will catch up on next write.
      logger.warn(`DbCircuitBreaker: failed to persist state for '${this.serviceName}'`, {
        error: err instanceof Error ? err.message : String(err),
        newState: s.state,
      });
    }

    logger.info(`DbCircuitBreaker state transition: '${this.serviceName}' → ${s.state}`, {
      failureCount: s.failureCount,
      successCount: s.successCount,
    });
  }
}
