/**
 * KgExecutor adapters.
 *
 * Both `pg.Pool`/`pg.Client` and `PGlite` expose `query(text, params) =>
 * { rows }`, so a single thin adapter serves production (Neon pool) and tests
 * (PGlite). Kept structurally typed to avoid importing either driver here.
 */

import type { KgExecutor } from '../types.js';

interface QueryClient {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

/** Wrap any `{ query(text, params) => { rows } }` client as a KgExecutor. */
export function makeExecutor(client: QueryClient): KgExecutor {
  return {
    async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
      const result = await client.query(text, params);
      return result.rows as T[];
    },
  };
}
