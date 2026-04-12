/**
 * Database Validation Utilities
 *
 * Validates database connections and schema.
 *
 * @dependencies
 * - scripts/lib/logger.ts - Logger utilities
 * - pg - PostgreSQL client for connection testing
 */

import { getSSLConfig } from '../database/ssl-config.js';
import { createLogger, type Logger } from '../logger.js';

export interface DatabaseConnectionResult {
  connected: boolean;
  error?: string;
  latencyMs?: number;
  serverVersion?: string;
  database?: string;
  isNeon?: boolean;
  isSupabase?: boolean;
}

/**
 * Parses a PostgreSQL connection string to extract components.
 */
export function parseConnectionString(connectionString: string): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
} | null {
  try {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: Number.parseInt(url.port, 10) || 5432,
      database: url.pathname.slice(1) || 'postgres',
      user: url.username,
      password: url.password,
      ssl: url.searchParams.get('sslmode') !== 'disable',
    };
  } catch {
    return null;
  }
}

/**
 * Detects the database provider from a connection string.
 */
export function detectDatabaseProvider(
  connectionString: string,
): 'neon' | 'supabase' | 'postgres' | 'unknown' {
  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname.endsWith('.neon.tech') || hostname === 'neon.tech') {
      return 'neon';
    }

    if (hostname.endsWith('.supabase.co') || hostname === 'pooler.supabase.com') {
      return 'supabase';
    }

    if (parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:') {
      return 'postgres';
    }
  } catch {
    // Not a valid URL, fall through to unknown
  }

  return 'unknown';
}

/**
 * Validates a database connection by attempting to connect.
 *
 * @example
 * ```typescript
 * const result = await validateDatabaseConnection(process.env.POSTGRES_URL!)
 * if (!result.connected) {
 *   console.error('Connection failed:', result.error)
 * }
 * ```
 */
export async function validateDatabaseConnection(
  connectionString: string,
  options: { timeout?: number; logger?: Logger } = {},
): Promise<DatabaseConnectionResult> {
  const { timeout = 10000, logger = createLogger({ level: 'silent' }) } = options;

  const provider = detectDatabaseProvider(connectionString);
  const result: DatabaseConnectionResult = {
    connected: false,
    isNeon: provider === 'neon',
    isSupabase: provider === 'supabase',
  };

  const startTime = Date.now();

  try {
    // Use pg Pool for connection testing
    const { Pool } = await import('pg');

    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: timeout,
      ssl: getSSLConfig(connectionString),
    });

    try {
      const client = await pool.connect();

      try {
        // Test basic query
        const versionResult = await client.query('SELECT version(), current_database()');
        const row = versionResult.rows[0];

        result.connected = true;
        result.latencyMs = Date.now() - startTime;
        result.serverVersion = row?.version?.split(' ')[1] || 'unknown';
        result.database = row?.current_database || 'unknown';

        logger.success(`Connected to ${provider} database: ${result.database}`);
        logger.info(`Latency: ${result.latencyMs}ms`);
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to connect to database: ${result.error}`);
  }

  return result;
}

/**
 * Validates that required tables exist in the database.
 *
 * @example
 * ```typescript
 * const { valid, missing } = await validateTables(connectionString, ['users', 'sessions', 'sites'])
 * ```
 */
export async function validateTables(
  connectionString: string,
  expectedTables: string[],
): Promise<{ valid: boolean; existing: string[]; missing: string[] }> {
  const { Pool } = await import('pg');

  const pool = new Pool({
    connectionString,
    ssl: getSSLConfig(connectionString),
  });

  try {
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
      `);

      const existingTables = new Set(result.rows.map((r) => r.table_name));
      const existing = expectedTables.filter((t) => existingTables.has(t));
      const missing = expectedTables.filter((t) => !existingTables.has(t));

      return {
        valid: missing.length === 0,
        existing,
        missing,
      };
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

/**
 * Gets the list of all tables in the database.
 */
export async function listTables(connectionString: string): Promise<string[]> {
  const { Pool } = await import('pg');

  const pool = new Pool({
    connectionString,
    ssl: getSSLConfig(connectionString),
  });

  try {
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      return result.rows.map((r) => r.table_name);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

/**
 * Core tables that should exist in the RevealUI database.
 */
export const CORE_TABLES = [
  'users',
  'sessions',
  'sites',
  'pages',
  'page_revisions',
  'site_collaborators',
  'media',
  'posts',
  'global_settings',
  'global_header',
  'global_footer',
];

/**
 * Agent-related tables.
 */
export const AGENT_TABLES = ['agent_memories', 'agent_contexts', 'agent_actions', 'conversations'];

/**
 * CRDT-related tables.
 */
export const CRDT_TABLES = ['crdt_operations', 'node_id_mappings'];

/**
 * All expected tables in the RevealUI database.
 */
export const ALL_TABLES = [...CORE_TABLES, ...AGENT_TABLES, ...CRDT_TABLES];
