/**
 * DB adapter for MCP.
 * - `connectPglite()` initializes ElectricSQL/pglite client with CRDT metadata.
 * - `connectPostgres()` creates a standard Postgres client with Electric metadata.
 * - `createMcpDbClient()` factory that selects adapter based on config.
 *
 * Uses @revealui/contracts as the single source of truth for CRDT operation types.
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import getMcpConfig from '@revealui/config/mcp';
import type { CrdtOperationsInsert, CrdtOperationsRow } from '@revealui/contracts';
import { getSSLConfig } from '@revealui/core/database/ssl-config';

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  affectedRows?: number;
}

export type McpDbClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>;
  close: () => Promise<void>;
};

/** Re-export contracts CRDT types for consumers */
export type { CrdtOperationsInsert, CrdtOperationsRow };

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

// CRDT operations table schema for conflict-free replication
const CRDT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS crdt_operations (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    vector_clock JSONB NOT NULL,
    node_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_crdt_ops_document ON crdt_operations(document_id);
  CREATE INDEX IF NOT EXISTS idx_crdt_ops_node ON crdt_operations(node_id);
  CREATE INDEX IF NOT EXISTS idx_crdt_ops_created ON crdt_operations(created_at DESC);
`;

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

  // Create CRDT operations table
  await db.exec(CRDT_TABLE_SQL);

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

  // Create CRDT operations table
  await pool.query(CRDT_TABLE_SQL);

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
