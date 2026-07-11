/**
 * KgExecutor adapters.
 *
 * Both `pg.Pool`/`pg.Client` and `PGlite` expose `query(text, params) =>
 * { rows }`, so a single thin adapter serves production (Neon pool) and tests
 * (PGlite). Kept structurally typed to avoid importing either driver here.
 *
 * Two adapters:
 *   - `makeExecutor` wraps a single-connection client (PGlite, `pg.Client`).
 *     `transaction()` issues `BEGIN`/`COMMIT`/`ROLLBACK` on that same
 *     connection — correct because there is only one session.
 *   - `makePoolExecutor` wraps a connection pool (`pg.Pool`). `transaction()`
 *     checks out a dedicated pooled connection via `.connect()` so
 *     `BEGIN`/`COMMIT`/`ROLLBACK` apply to one session (not a session picked
 *     arbitrarily per query from the pool), then releases it. Plain `query()`
 *     calls outside a transaction use the pool directly (its normal
 *     per-call connection borrowing).
 */

import type { KgExecutor } from '../types.js';

interface QueryClient {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

interface PooledClient extends QueryClient {
  release(): void;
}

interface PoolLikeClient extends QueryClient {
  connect(): Promise<PooledClient>;
}

/** Wrap a single-connection client (PGlite, `pg.Client`) as a KgExecutor. */
export function makeExecutor(client: QueryClient): KgExecutor {
  const exec: KgExecutor = {
    async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
      const result = await client.query(text, params);
      return result.rows as T[];
    },
    async transaction<T>(fn: (tx: KgExecutor) => Promise<T>): Promise<T> {
      await client.query('BEGIN');
      try {
        const result = await fn(exec);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // The connection may already be unusable after the original error;
          // the original error is what the caller needs to see.
        }
        throw error;
      }
    },
  };
  return exec;
}

/** Wrap a connection pool (`pg.Pool`) as a KgExecutor. */
export function makePoolExecutor(pool: PoolLikeClient): KgExecutor {
  return {
    async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
      const result = await pool.query(text, params);
      return result.rows as T[];
    },
    async transaction<T>(fn: (tx: KgExecutor) => Promise<T>): Promise<T> {
      const conn = await pool.connect();
      try {
        return await makeExecutor(conn).transaction(fn);
      } finally {
        conn.release();
      }
    },
  };
}
