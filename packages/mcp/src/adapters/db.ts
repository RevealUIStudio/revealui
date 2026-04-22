/**
 * DB adapter for MCP.
 * - `connectPglite()` returns a PGlite-backed client.
 * - `connectPostgres()` returns a `pg.Pool`-backed client.
 * - `createMcpDbClient()` selects adapter based on `persistenceDriver` config.
 *
 * Schema is the caller's responsibility — these factories do NOT bootstrap any
 * tables. Apply drizzle-kit migrations (`pnpm --filter @revealui/db db:migrate`
 * or the PGlite equivalent) before issuing queries.
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import getMcpConfig from '@revealui/config/mcp';
import { getSSLConfig } from '@revealui/core/database/ssl-config';

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  affectedRows?: number;
}

export type McpDbClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>;
  close: () => Promise<void>;
};

// Type for PGlite instance (minimal interface to avoid import issues)
interface PGliteInstance {
  waitReady: Promise<void>;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(query: string): Promise<unknown>;
  close(): Promise<void>;
}

/**
 * Connect to PGlite (embedded PostgreSQL) for local development/testing.
 * Uses dynamic import to avoid bundling @electric-sql/pglite when not needed.
 *
 * @param options - Optional connection options
 * @param options.dataDir - Override the default data directory. Use ':memory:' for in-memory.
 */
export async function connectPglite(options?: { dataDir?: string }): Promise<McpDbClient> {
  const cfg = getMcpConfig();

  // Determine data directory from options, config, or default
  // Use ':memory:' for in-memory database (useful for testing)
  const dataDir = options?.dataDir || cfg.electricDatabaseUrl || '.revealui/mcp/pglite';

  let db: PGliteInstance;

  try {
    // Ensure directory exists if not in-memory
    if (dataDir !== ':memory:') {
      await mkdir(dirname(dataDir), { recursive: true });
    }

    const { PGlite } = await import('@electric-sql/pglite');
    db = new PGlite(dataDir) as PGliteInstance;
    await db.waitReady;
  } catch (error) {
    const err = error as Error;
    if (err.message?.includes('Cannot find module') || err.message?.includes('MODULE_NOT_FOUND')) {
      throw new Error(
        '@electric-sql/pglite is not installed. Run: pnpm add -D @electric-sql/pglite',
      );
    }
    throw error;
  }

  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<QueryResult<T>> {
      const result = await db.query(sql, params);
      return {
        rows: result.rows as T[],
        affectedRows: result.affectedRows,
      };
    },
    async close(): Promise<void> {
      await db.close();
    },
  };
}

/**
 * Connect to PostgreSQL for production use.
 * Supports Neon, Supabase, and generic PostgreSQL with SSL.
 */
export async function connectPostgres(): Promise<McpDbClient> {
  const cfg = getMcpConfig();

  const connectionString =
    cfg.electricDatabaseUrl ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DATABASE_URI;

  if (!connectionString) {
    throw new Error(
      'Database connection string not found. Set ELECTRIC_DATABASE_URL, DATABASE_URL, POSTGRES_URL, or SUPABASE_DATABASE_URI.',
    );
  }

  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString,
    ssl: getSSLConfig(connectionString),
  });

  // Test connection
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }

  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<QueryResult<T>> {
      const result = await pool.query(sql, params);
      return {
        rows: result.rows as T[],
        affectedRows: result.rowCount ?? undefined,
      };
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}

/**
 * Factory function that creates an MCP database client based on configuration.
 * Reads `persistenceDriver` from getMcpConfig() to determine which adapter to use.
 */
export async function createMcpDbClient(): Promise<McpDbClient> {
  const cfg = getMcpConfig();

  if (cfg.persistenceDriver === 'postgres') {
    return connectPostgres();
  }

  // Default to pglite for local development
  return connectPglite();
}

export default { connectPglite, connectPostgres, createMcpDbClient };
