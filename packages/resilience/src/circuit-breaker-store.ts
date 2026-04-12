/**
 * Circuit Breaker State Store  -  Pluggable backends for circuit breaker persistence.
 *
 * - InMemoryCircuitBreakerStore: Map-backed, single-instance (default)
 * - PGliteCircuitBreakerStore: SQL-backed via PGlite, persistent across restarts
 *
 * Stores only the durable state needed for recovery: state, counters, timestamps.
 * Timers and callbacks remain in-memory on the CircuitBreaker instance.
 */

import type { CircuitState } from './circuit-breaker.js';

// =============================================================================
// Store interface
// =============================================================================

export interface CircuitBreakerSnapshot {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureAt: number;
  lastSuccessAt: number;
  stateChangedAt: number;
}

/**
 * Pluggable storage backend for circuit breaker state.
 * Each service gets its own named breaker.
 */
export interface CircuitBreakerStore {
  /** Load the state for a named service, or null if no state exists. */
  load(name: string): Promise<CircuitBreakerSnapshot | null>;

  /** Persist a snapshot for a named service. */
  save(name: string, snapshot: CircuitBreakerSnapshot): Promise<void>;

  /** Remove state for a named service. Returns true if it existed. */
  remove(name: string): Promise<boolean>;

  /** Clear all circuit breaker state. */
  clear(): Promise<void>;

  /** Release any resources. */
  close(): Promise<void>;
}

// =============================================================================
// In-memory store (Map-backed, default)
// =============================================================================

export class InMemoryCircuitBreakerStore implements CircuitBreakerStore {
  private state = new Map<string, CircuitBreakerSnapshot>();

  async load(name: string): Promise<CircuitBreakerSnapshot | null> {
    const snapshot = this.state.get(name);
    return snapshot ? { ...snapshot } : null;
  }

  async save(name: string, snapshot: CircuitBreakerSnapshot): Promise<void> {
    this.state.set(name, { ...snapshot });
  }

  async remove(name: string): Promise<boolean> {
    return this.state.delete(name);
  }

  async clear(): Promise<void> {
    this.state.clear();
  }

  async close(): Promise<void> {
    this.state.clear();
  }
}

// =============================================================================
// PGlite store (SQL-backed)
// =============================================================================

/** Minimal PGlite interface  -  avoids importing the full @electric-sql/pglite package. */
interface PGliteInstance {
  exec(query: string): Promise<unknown>;
  query<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

const CREATE_CB_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _circuit_breaker_state (
    name                  TEXT PRIMARY KEY,
    state                 TEXT NOT NULL DEFAULT 'closed',
    failure_count         INTEGER NOT NULL DEFAULT 0,
    success_count         INTEGER NOT NULL DEFAULT 0,
    consecutive_failures  INTEGER NOT NULL DEFAULT 0,
    consecutive_successes INTEGER NOT NULL DEFAULT 0,
    last_failure_at       BIGINT NOT NULL DEFAULT 0,
    last_success_at       BIGINT NOT NULL DEFAULT 0,
    state_changed_at      BIGINT NOT NULL DEFAULT 0
  );
`;

interface PGliteCircuitBreakerStoreOptions {
  /** PGlite instance (caller owns lifecycle unless closeOnDestroy is true). */
  db: PGliteInstance;
  /** Close the PGlite instance when close() is called (default: false). */
  closeOnDestroy?: boolean;
}

interface CBRow {
  state: string;
  failure_count: number;
  success_count: number;
  consecutive_failures: number;
  consecutive_successes: number;
  last_failure_at: string;
  last_success_at: string;
  state_changed_at: string;
}

export class PGliteCircuitBreakerStore implements CircuitBreakerStore {
  private db: PGliteInstance;
  private ready: Promise<void>;
  private closeOnDestroy: boolean;

  constructor(options: PGliteCircuitBreakerStoreOptions) {
    this.db = options.db;
    this.closeOnDestroy = options.closeOnDestroy ?? false;
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    await this.db.exec(CREATE_CB_TABLE_SQL);
  }

  async load(name: string): Promise<CircuitBreakerSnapshot | null> {
    await this.ready;
    const result = await this.db.query<CBRow>(
      'SELECT state, failure_count, success_count, consecutive_failures, consecutive_successes, last_failure_at, last_success_at, state_changed_at FROM _circuit_breaker_state WHERE name = $1',
      [name],
    );
    const row = result.rows[0];
    if (!row) return null;

    return {
      state: row.state as CircuitState,
      failureCount: row.failure_count,
      successCount: row.success_count,
      consecutiveFailures: row.consecutive_failures,
      consecutiveSuccesses: row.consecutive_successes,
      lastFailureAt: Number(row.last_failure_at),
      lastSuccessAt: Number(row.last_success_at),
      stateChangedAt: Number(row.state_changed_at),
    };
  }

  async save(name: string, snapshot: CircuitBreakerSnapshot): Promise<void> {
    await this.ready;
    await this.db.query(
      `INSERT INTO _circuit_breaker_state
         (name, state, failure_count, success_count, consecutive_failures, consecutive_successes, last_failure_at, last_success_at, state_changed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (name) DO UPDATE SET
         state = EXCLUDED.state,
         failure_count = EXCLUDED.failure_count,
         success_count = EXCLUDED.success_count,
         consecutive_failures = EXCLUDED.consecutive_failures,
         consecutive_successes = EXCLUDED.consecutive_successes,
         last_failure_at = EXCLUDED.last_failure_at,
         last_success_at = EXCLUDED.last_success_at,
         state_changed_at = EXCLUDED.state_changed_at`,
      [
        name,
        snapshot.state,
        snapshot.failureCount,
        snapshot.successCount,
        snapshot.consecutiveFailures,
        snapshot.consecutiveSuccesses,
        snapshot.lastFailureAt,
        snapshot.lastSuccessAt,
        snapshot.stateChangedAt,
      ],
    );
  }

  async remove(name: string): Promise<boolean> {
    await this.ready;
    const result = await this.db.query<{ count: string }>(
      `WITH deleted AS (DELETE FROM _circuit_breaker_state WHERE name = $1 RETURNING 1)
       SELECT count(*)::text AS count FROM deleted`,
      [name],
    );
    return Number.parseInt(result.rows[0]?.count ?? '0', 10) > 0;
  }

  async clear(): Promise<void> {
    await this.ready;
    await this.db.exec('DELETE FROM _circuit_breaker_state');
  }

  async close(): Promise<void> {
    if (this.closeOnDestroy) {
      await this.db.close();
    }
  }
}
