/**
 * Postgres-backed Idempotency Store
 *
 * Persistent implementation of the {@link IdempotencyStore} interface
 * using a PostgreSQL table. Stores MCP responses keyed by idempotency
 * key with automatic TTL expiration via a `expires_at` column.
 *
 * Table schema (auto-created on first use):
 *   mcp_idempotency_cache (
 *     key        TEXT PRIMARY KEY,
 *     response   JSONB NOT NULL,
 *     expires_at TIMESTAMPTZ NOT NULL
 *   )
 */

import type { IdempotencyStore, MCPResponse } from '../servers/adapter.js';

interface PgClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const TABLE = 'mcp_idempotency_cache';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    key        TEXT PRIMARY KEY,
    response   JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  );
`;

/**
 * Create a Postgres-backed idempotency store.
 *
 * @param client - Any object with a `.query(text, values?)` method
 *                 (e.g. `pg.Pool`, `pg.Client`, `@neondatabase/serverless` pool).
 * @param opts   - Optional configuration
 */
export function createPostgresIdempotencyStore(
  client: PgClient,
  opts?: { ensureTable?: boolean },
): IdempotencyStore {
  let tableEnsured = opts?.ensureTable === false;

  async function ensureTable(): Promise<void> {
    if (tableEnsured) return;
    await client.query(CREATE_TABLE_SQL);
    tableEnsured = true;
  }

  return {
    async get(key: string): Promise<{ response: MCPResponse; expiresAt: number } | null> {
      await ensureTable();
      const { rows } = await client.query(
        `SELECT response, expires_at FROM ${TABLE} WHERE key = $1 AND expires_at > NOW()`,
        [key],
      );
      const row = rows[0];
      if (!row) return null;
      return {
        response: row.response as MCPResponse,
        expiresAt: new Date(row.expires_at as string).getTime(),
      };
    },

    async set(key: string, response: MCPResponse, ttlMs: number): Promise<void> {
      await ensureTable();
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();
      await client.query(
        `INSERT INTO ${TABLE} (key, response, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET response = $2, expires_at = $3`,
        [key, JSON.stringify(response), expiresAt],
      );
    },

    async delete(key: string): Promise<void> {
      await ensureTable();
      await client.query(`DELETE FROM ${TABLE} WHERE key = $1`, [key]);
    },
  };
}
