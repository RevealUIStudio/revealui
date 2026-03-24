/**
 * Database Connection Factory
 *
 * Provides connection utilities for both Neon (REST) and Supabase (Vector) databases.
 *
 * @dependencies
 * - scripts/lib/index.ts - Logger and database provider detection
 * - pg - PostgreSQL client library
 */

import type { Pool, PoolClient } from 'pg';
import { createLogger, detectDatabaseProvider, type Logger } from '../index.js';
import { getSSLConfig } from './ssl-config.js';

export type DatabaseType = 'rest' | 'vector';

export interface ConnectionConfig {
  connectionString: string;
  type?: DatabaseType;
  ssl?: boolean;
  poolSize?: number;
  connectionTimeout?: number;
  logger?: Logger;
}

export interface DatabaseConnection {
  pool: Pool;
  type: DatabaseType;
  provider: 'neon' | 'supabase' | 'postgres' | 'unknown';
  connect(): Promise<PoolClient>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
  close(): Promise<void>;
}

const defaultLogger = createLogger({ level: 'silent' });

/**
 * Creates a database connection with automatic provider detection.
 */
export async function createConnection(config: ConnectionConfig): Promise<DatabaseConnection> {
  const {
    connectionString,
    type = 'rest',
    ssl = true,
    poolSize = 5,
    connectionTimeout = 10000,
    logger = defaultLogger,
  } = config;

  const provider = detectDatabaseProvider(connectionString);

  logger.debug(`Creating ${type} connection to ${provider} database`);

  const { Pool } = await import('pg');

  const pool = new Pool({
    connectionString,
    ssl: ssl ? getSSLConfig(connectionString) : undefined,
    max: poolSize,
    connectionTimeoutMillis: connectionTimeout,
  });

  return {
    pool,
    type,
    provider,

    async connect(): Promise<PoolClient> {
      return pool.connect();
    },

    async query<T = unknown>(
      sql: string,
      params?: unknown[],
    ): Promise<{ rows: T[]; rowCount: number }> {
      const result = await pool.query(sql, params);
      return {
        rows: result.rows as T[],
        rowCount: result.rowCount ?? 0,
      };
    },

    async close(): Promise<void> {
      await pool.end();
    },
  };
}

/**
 * Gets the REST database connection string from environment.
 */
export function getRestConnectionString(): string | undefined {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL;
}

/**
 * Gets the Vector database connection string from environment.
 */
export function getVectorConnectionString(): string | undefined {
  return (
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URI
  );
}

/**
 * Creates connections for both REST and Vector databases.
 */
export async function createDualConnections(
  options: { logger?: Logger } = {},
): Promise<{ rest?: DatabaseConnection; vector?: DatabaseConnection }> {
  const { logger = defaultLogger } = options;
  const connections: { rest?: DatabaseConnection; vector?: DatabaseConnection } = {};

  const restUrl = getRestConnectionString();
  if (restUrl) {
    connections.rest = await createConnection({
      connectionString: restUrl,
      type: 'rest',
      logger,
    });
  }

  const vectorUrl = getVectorConnectionString();
  if (vectorUrl && vectorUrl !== restUrl) {
    connections.vector = await createConnection({
      connectionString: vectorUrl,
      type: 'vector',
      logger,
    });
  }

  return connections;
}

/**
 * Tests a database connection.
 */
export async function testConnection(
  connection: DatabaseConnection,
  logger: Logger = defaultLogger,
): Promise<boolean> {
  try {
    const start = Date.now();
    const result = await connection.query<{ version: string }>('SELECT version()');
    const latency = Date.now() - start;

    logger.success(`Connected to ${connection.provider} database (${latency}ms)`);
    logger.debug(`Server version: ${result.rows[0]?.version?.split(' ')[1] || 'unknown'}`);

    return true;
  } catch (error) {
    logger.error(`Connection failed: ${error}`);
    return false;
  }
}
