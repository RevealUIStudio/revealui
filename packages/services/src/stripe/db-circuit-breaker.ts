/**
 * DB-Backed Circuit Breaker
 *
 * Stores circuit state in NeonDB so all API instances share the same view.
 *
 * Architecture:
 *   - Local in-memory cache (5s TTL) — fast read path, no DB hit per request
 *   - DB write only on state transitions (open/closed/half-open changes)
 *   - Fail-open on DB errors: if we can't read state, we let the call through
 *     rather than blocking all traffic because the circuit state store is down
 */

import { createLogger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { circuitBreakerState } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';

const logger = createLogger({ service: 'DbCircuitBreaker' });

type CircuitState = 'closed' | 'open' | 'half-open';

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

export class DbCircuitBreaker {
  private readonly config: DbCircuitBreakerConfig;

  constructor(
    private readonly serviceName: string,
    config: Partial<DbCircuitBreakerConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
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
        // Update local cache only — no DB write until threshold is reached
        localCache.set(this.serviceName, {
          ...s,
          successCount: newSuccesses,
          cachedAt: s.cachedAt,
        });
      }
      return;
    }

    if (s.state === 'closed' && s.failureCount > 0) {
      // Reset sub-threshold failure counter locally (no DB write needed)
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
      // Sub-threshold: update local counter without hitting DB
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

  /** Clear only the local cache (forces next read to hit DB). For testing. */
  clearLocalCache(): void {
    localCache.delete(this.serviceName);
  }

  // ---------------------------------------------------------------------------

  private async readState(): Promise<CachedState> {
    const cached = localCache.get(this.serviceName);
    if (cached && Date.now() - cached.cachedAt < this.config.cacheTtlMs) {
      return cached;
    }
    return this.readFromDb();
  }

  private async readFromDb(): Promise<CachedState> {
    try {
      const db = getClient();
      const [row] = await db
        .select()
        .from(circuitBreakerState)
        .where(eq(circuitBreakerState.serviceName, this.serviceName));

      const state: CachedState = row
        ? {
            state: row.state as CircuitState,
            failureCount: row.failureCount,
            successCount: row.successCount,
            lastFailureAt: row.lastFailureAt?.getTime() ?? 0,
            stateChangedAt: row.stateChangedAt.getTime(),
            cachedAt: Date.now(),
          }
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
      // Fail-open: if DB is unreachable, default to closed so Stripe calls proceed.
      // We log a warning but don't block traffic over a missing circuit state row.
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
    const now = new Date();
    // Optimistically update local cache first so subsequent in-process
    // calls see the new state without waiting for the DB round-trip to complete.
    localCache.set(this.serviceName, { ...s, cachedAt: Date.now() });

    try {
      const db = getClient();
      await db
        .insert(circuitBreakerState)
        .values({
          serviceName: this.serviceName,
          state: s.state,
          failureCount: s.failureCount,
          successCount: s.successCount,
          lastFailureAt: s.lastFailureAt ? new Date(s.lastFailureAt) : null,
          stateChangedAt: new Date(s.stateChangedAt),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: circuitBreakerState.serviceName,
          set: {
            state: s.state,
            failureCount: s.failureCount,
            successCount: s.successCount,
            lastFailureAt: s.lastFailureAt ? new Date(s.lastFailureAt) : null,
            stateChangedAt: new Date(s.stateChangedAt),
            updatedAt: now,
          },
        });
    } catch (err) {
      // Non-fatal: local cache has the new state; DB will catch up on next write.
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
