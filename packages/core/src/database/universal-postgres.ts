/**
 * Universal PostgreSQL Adapter for RevealUI admin
 *
 * Supports multiple PostgreSQL providers:
 * - Neon Database (https://neon.tech)
 * - Supabase (https://supabase.com)
 * - Vercel Postgres (https://vercel.com/storage/postgres)
 *
 * Automatically detects the provider based on connection string or environment.
 *
 * WARNING: This module uses Node.js-specific database drivers.
 * Do NOT import in client-side code or edge runtime.
 */

import type { Field } from '@revealui/contracts/admin';
import { defaultLogger } from '../instance/logger.js';
import { logger } from '../observability/logger.js';
import type { DatabaseAdapter, DatabaseResult, QueryableDatabaseAdapter } from '../types/index.js';
import { safeParseRevealDocuments } from './safe-parse.js';
import { getSSLConfig } from './ssl-config.js';

export interface UniversalPostgresAdapterConfig {
  /**
   * Connection string for the database
   * Examples:
   * - Neon: postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require
   * - Supabase: postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres
   * - Vercel: postgres://user:pass@host:5432/dbname
   */
  connectionString?: string;
  /**
   * Environment variable name for connection string
   * Defaults to checking: DATABASE_URL, POSTGRES_URL, SUPABASE_DATABASE_URI
   */
  envVar?: string;
  /**
   * Force a specific provider (optional, auto-detected if not provided)
   */
  provider?: 'neon' | 'supabase' | 'electric';
}

/**
 * Worker-isolated PGlite instances for parallel test execution
 * Each Vitest worker thread gets its own isolated database instance
 * Key: worker ID (from VITEST_WORKER_ID env var)
 * Value: PGlite instance for that worker
 */
const workerPGliteInstances = new Map<
  string,
  InstanceType<typeof import('@electric-sql/pglite').PGlite>
>();

/**
 * Worker-isolated table creation promises
 * Each worker tracks its own pending table creations
 */
const workerPendingTableCreations = new Map<string, Promise<void>[]>();

/**
 * Worker-isolated table tracking
 * Each worker tracks which tables it has created
 */
const workerCreatedTables = new Map<string, Set<string>>();

/**
 * Get the current worker ID for test isolation
 * In tests: Uses VITEST_WORKER_ID to isolate per worker thread
 * In production: Uses 'main' for single shared instance
 */
function getWorkerID(): string {
  return process.env.VITEST_WORKER_ID || 'main';
}

/**
 * Get or create worker-specific PGlite instance
 */
function getWorkerPGliteInstance(): InstanceType<
  typeof import('@electric-sql/pglite').PGlite
> | null {
  const workerID = getWorkerID();
  return workerPGliteInstances.get(workerID) || null;
}

/**
 * Set worker-specific PGlite instance
 */
function setWorkerPGliteInstance(
  instance: InstanceType<typeof import('@electric-sql/pglite').PGlite>,
): void {
  const workerID = getWorkerID();
  workerPGliteInstances.set(workerID, instance);
}

/**
 * Get worker-specific pending table creations
 */
function getWorkerPendingTableCreations(): Promise<void>[] {
  const workerID = getWorkerID();
  if (!workerPendingTableCreations.has(workerID)) {
    workerPendingTableCreations.set(workerID, []);
  }
  // biome-ignore lint/style/noNonNullAssertion: guaranteed by has-check + set above
  return workerPendingTableCreations.get(workerID)!;
}

/**
 * Get worker-specific created tables set
 */
function getWorkerCreatedTables(): Set<string> {
  const workerID = getWorkerID();
  if (!workerCreatedTables.has(workerID)) {
    workerCreatedTables.set(workerID, new Set<string>());
  }
  // biome-ignore lint/style/noNonNullAssertion: guaranteed by has-check + set above
  return workerCreatedTables.get(workerID)!;
}

/**
 * Detects the PostgreSQL provider from connection string
 */
function detectProvider(connectionString: string): 'neon' | 'supabase' | 'electric' | 'generic' {
  const url = connectionString.toLowerCase();

  if (url.includes('.neon.tech') || url.includes('neon.tech')) {
    return 'neon';
  }

  if (url.includes('.supabase.co') || url.includes('supabase')) {
    return 'supabase';
  }

  if (url.includes('electric')) {
    return 'electric';
  }

  return 'generic';
}

/**
 * Creates a universal PostgreSQL adapter that works with Neon, Supabase, and Electric Postgres
 */
export function universalPostgresAdapter(
  config: UniversalPostgresAdapterConfig = {},
): DatabaseAdapter {
  let queryFn: (queryString: string, values: unknown[]) => Promise<DatabaseResult>;
  let transactionFn: <T>(fn: (tx: QueryableDatabaseAdapter) => Promise<T>) => Promise<T>;
  let provider: 'neon' | 'supabase' | 'electric' | 'generic' = 'generic';

  // Shared transaction builder for pg-library-backed providers (neon, supabase, generic).
  // Holds one pooled client across BEGIN/fn/COMMIT so every query inside `fn` sees the
  // same snapshot — required for read-after-write correctness.
  type PgClient = {
    query: (q: string, v?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
    release: () => void;
  };
  const buildPgTransactionFn = (
    pool: { connect: () => Promise<PgClient> },
    providerLabel: string,
  ): typeof transactionFn => {
    return async <T>(fn: (tx: QueryableDatabaseAdapter) => Promise<T>): Promise<T> => {
      const client = await pool.connect();
      let committed = false;
      try {
        await client.query('BEGIN');
        const tx: QueryableDatabaseAdapter = {
          query: async (queryString: string, values: unknown[] = []) => {
            const result = await client.query(queryString, values);
            return {
              rows: safeParseRevealDocuments(result.rows),
              rowCount: result.rowCount || 0,
            };
          },
        };
        const result = await fn(tx);
        await client.query('COMMIT');
        committed = true;
        return result;
      } catch (error) {
        if (!committed) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackErr) {
            defaultLogger.error(
              `${providerLabel} transaction rollback failed after error:`,
              rollbackErr,
            );
          }
        }
        throw error;
      } finally {
        client.release();
      }
    };
  };

  const initializeConnection = async (): Promise<void> => {
    // Allow explicit electric provider without a connection string (PGlite local)
    let connectionString: string | undefined;

    if (config.provider === 'electric') {
      provider = 'electric';
    } else {
      // Get connection string from config or environment
      connectionString =
        config.connectionString ||
        process.env[config.envVar || 'DATABASE_URL'] ||
        process.env.POSTGRES_URL ||
        process.env.SUPABASE_DATABASE_URI ||
        process.env.DATABASE_URL;

      if (!connectionString) {
        throw new Error(
          'Database connection string not found. Set DATABASE_URL, POSTGRES_URL, or SUPABASE_DATABASE_URI environment variable.',
        );
      }

      // Detect provider if not explicitly set
      provider = config.provider || detectProvider(connectionString);
    }

    // Initialize provider-specific query function
    // Note: connectionString is guaranteed defined for non-electric providers (throws at line 81 if undefined)
    switch (provider) {
      case 'neon': {
        // Use pg library for Neon (more compatible with parameterized queries)
        // Neon serverless has limitations with $1, $2 style parameters
        // Using pg ensures full PostgreSQL compatibility
        // biome-ignore lint/style/noNonNullAssertion: non-electric providers throw above if connectionString is missing
        const neonConnectionString = connectionString!;
        const { Pool: NeonPool } = await import('pg');
        const neonPool = new NeonPool({
          connectionString: neonConnectionString,
          ssl: getSSLConfig(neonConnectionString),
        });

        queryFn = async (queryString: string, values: unknown[] = []) => {
          try {
            const client = await neonPool.connect();
            try {
              const result = await client.query(queryString, values);
              return {
                rows: safeParseRevealDocuments(result.rows),
                rowCount: result.rowCount || 0,
              };
            } finally {
              client.release();
            }
          } catch (error) {
            defaultLogger.error('Neon database query error:', error);
            throw error;
          }
        };
        transactionFn = buildPgTransactionFn(neonPool, 'Neon');
        break;
      }

      case 'supabase': {
        // CRITICAL: For Supabase transaction pooling (port 6543), we use pg library
        // Transaction pooling works fine with pg - no special configuration needed
        // Reference: https://supabase.com/docs/guides/database/connecting-to-postgres
        // biome-ignore lint/style/noNonNullAssertion: non-electric providers throw above if connectionString is missing
        const supabaseConnectionString = connectionString!;
        const isTransactionPooling = supabaseConnectionString.includes(':6543');

        if (isTransactionPooling) {
          // For transaction pooling: Use pg library with parameterized queries
          // pg supports $1, $2 style parameters without prepared statements
          const { Pool } = await import('pg');
          const pool = new Pool({
            connectionString: supabaseConnectionString,
            ssl: getSSLConfig(supabaseConnectionString),
          });

          queryFn = async (queryString: string, values: unknown[] = []) => {
            const client = await pool.connect();
            try {
              const result = await client.query(queryString, values);
              return {
                rows: safeParseRevealDocuments(result.rows),
                rowCount: result.rowCount || 0,
              };
            } finally {
              client.release();
            }
          };
          transactionFn = buildPgTransactionFn(pool, 'Supabase (txn-pool)');
        } else {
          // Use pg library for session pooling or direct connections (port 5432)
          const { Pool } = await import('pg');
          const pool = new Pool({
            connectionString: supabaseConnectionString,
            ssl: getSSLConfig(supabaseConnectionString),
          });

          queryFn = async (queryString: string, values: unknown[] = []) => {
            try {
              const client = await pool.connect();
              try {
                const result = await client.query(queryString, values);
                return {
                  rows: safeParseRevealDocuments(result.rows),
                  rowCount: result.rowCount || 0,
                };
              } finally {
                client.release();
              }
            } catch (error) {
              defaultLogger.error('Supabase database query error:', error);
              throw error;
            }
          };
          transactionFn = buildPgTransactionFn(pool, 'Supabase');
        }
        break;
      }

      case 'electric': {
        // Use worker-isolated PGlite instance for parallel test execution
        // Each Vitest worker gets its own database instance to prevent race conditions
        let db = getWorkerPGliteInstance();
        if (!db) {
          const { PGlite } = await import('@electric-sql/pglite');
          db = new PGlite();
          setWorkerPGliteInstance(db);
        }

        queryFn = async (queryString: string, values: unknown[] = []) => {
          const result = await db.query(queryString, values);
          return {
            rows: safeParseRevealDocuments(result.rows),
            rowCount: (result as { rowCount?: number }).rowCount || 0,
          };
        };
        // PGlite ships a native transaction(fn) with its own tx.query — wrap it
        // so the callback sees a QueryableDatabaseAdapter.
        transactionFn = async <T>(fn: (tx: QueryableDatabaseAdapter) => Promise<T>): Promise<T> => {
          // biome-ignore lint/style/noNonNullAssertion: db is set above in the electric branch
          return await db!.transaction(async (pgliteTx) => {
            const tx: QueryableDatabaseAdapter = {
              query: async (queryString: string, values: unknown[] = []) => {
                const result = await pgliteTx.query(queryString, values);
                return {
                  rows: safeParseRevealDocuments(result.rows),
                  rowCount: (result as { rowCount?: number }).rowCount || 0,
                };
              },
            };
            return await fn(tx);
          });
        };
        break;
      }

      default: {
        // Generic PostgreSQL using pg (node-postgres)
        // biome-ignore lint/style/noNonNullAssertion: non-electric providers throw above if connectionString is missing
        const genericConnectionString = connectionString!;
        const { Pool } = await import('pg');
        const pool = new Pool({
          connectionString: genericConnectionString,
          ssl: getSSLConfig(genericConnectionString),
        });

        queryFn = async (queryString: string, values: unknown[] = []) => {
          try {
            const client = await pool.connect();
            try {
              const result = await client.query(queryString, values);
              return {
                rows: safeParseRevealDocuments(result.rows),
                rowCount: result.rowCount || 0,
              };
            } finally {
              client.release();
            }
          } catch (error) {
            defaultLogger.error('PostgreSQL query error:', error);
            throw error;
          }
        };
        transactionFn = buildPgTransactionFn(pool, 'PostgreSQL');
        break;
      }
    }
  };

  let initialized = false;

  return {
    async init(): Promise<void> {
      // Initialize connection for PGlite
      if (!initialized) {
        await initializeConnection();
        initialized = true;
      }
    },

    async connect(): Promise<void> {
      if (!initialized) {
        await initializeConnection();
        initialized = true;
      }

      // Wait for all pending table creation promises to complete
      const pendingCreations = getWorkerPendingTableCreations();
      if (pendingCreations.length > 0) {
        try {
          await Promise.all(pendingCreations);
          // Clear promises after successful execution
          pendingCreations.length = 0;
        } catch (error) {
          defaultLogger.error('Failed to create tables:', error);
          throw error;
        }
      }

      // Test connection
      try {
        await queryFn('SELECT 1', []);
      } catch (error) {
        defaultLogger.error(`Failed to connect to ${provider} database:`, error);
        throw error;
      }
    },

    async disconnect(): Promise<void> {
      // Connection pooling is handled by the provider libraries
      // No explicit disconnect needed for most providers
      if (provider === 'supabase' || provider === 'generic') {
        // pg Pool cleanup would go here if needed
        // Most providers handle connection cleanup automatically
      }
      await Promise.resolve();
    },

    async query(queryString: string, values: unknown[] = []): Promise<DatabaseResult> {
      if (!initialized) {
        await initializeConnection();
        initialized = true;
      }

      // Wait for any pending table creations before executing queries
      const pendingCreations = getWorkerPendingTableCreations();
      if (pendingCreations.length > 0) {
        logger.debug('[PGlite] Query intercepted: waiting for pending table creations', {
          pendingCount: pendingCreations.length,
        });
        try {
          await Promise.all(pendingCreations);
          logger.debug('[PGlite] All table creations completed', {
            count: pendingCreations.length,
          });
          // Clear promises after successful execution
          pendingCreations.length = 0;
        } catch (error) {
          logger.error(
            '[PGlite] Table creation failed',
            error instanceof Error ? error : new Error(String(error)),
          );
          defaultLogger.error('Failed to create tables before query:', error);
          throw error;
        }
      }

      return queryFn(queryString, values);
    },

    async transaction<T>(fn: (tx: QueryableDatabaseAdapter) => Promise<T>): Promise<T> {
      if (!initialized) {
        await initializeConnection();
        initialized = true;
      }

      // Flush pending table creations before opening a transaction so the
      // schema is in place on the same connection we're about to hold.
      const pendingCreations = getWorkerPendingTableCreations();
      if (pendingCreations.length > 0) {
        try {
          await Promise.all(pendingCreations);
          pendingCreations.length = 0;
        } catch (error) {
          defaultLogger.error('Failed to create tables before transaction:', error);
          throw error;
        }
      }

      return transactionFn(fn);
    },

    // Create table schema for PGlite provider
    // For other providers, tables should be created via migrations
    createTable:
      config.provider === 'electric' ||
      !(
        config.connectionString ||
        config.envVar ||
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL ||
        process.env.SUPABASE_DATABASE_URI
      )
        ? (tableName: string, fields: Field[]) => {
            const createdTables = getWorkerCreatedTables();

            // Skip if table was already created in this worker
            if (createdTables.has(tableName)) {
              return;
            }

            // Mark as created to prevent duplicates in this worker
            createdTables.add(tableName);

            // Build CREATE TABLE SQL statement
            const columns: string[] = [
              'id TEXT PRIMARY KEY', // TEXT to support both string IDs (rvl_*) and integer IDs
              'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
              'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
              '_status TEXT', // Draft/published status
              '_json JSONB', // Store complex field types (arrays, relationships with hasMany, etc.)
            ];

            // Add fields from collection definition
            // Skip reserved columns (id, created_at, updated_at) as they're already added
            const reservedColumns = ['id', 'created_at', 'updated_at', 'createdAt', 'updatedAt'];
            for (const field of fields) {
              if ('name' in field && field.name && !reservedColumns.includes(field.name)) {
                let columnType = 'TEXT';

                // Map field types to PostgreSQL types
                if ('type' in field) {
                  switch (field.type) {
                    case 'number':
                      columnType = 'NUMERIC';
                      break;
                    case 'checkbox':
                      columnType = 'BOOLEAN';
                      break;
                    case 'date':
                      columnType = 'TIMESTAMP';
                      break;
                    case 'json':
                    case 'richText':
                    case 'array':
                    case 'blocks':
                      columnType = 'JSONB';
                      break;
                    case 'relationship':
                      columnType = 'INTEGER'; // Foreign key
                      break;
                    default:
                      columnType = 'TEXT';
                  }
                }

                const required = 'required' in field && field.required ? 'NOT NULL' : '';
                columns.push(`"${field.name}" ${columnType} ${required}`.trim());
              }
            }

            const createTableSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns.join(', ')})`;

            // Debug: log SQL
            logger.debug('[PGlite] CREATE TABLE SQL', { tableName, sql: createTableSQL });

            // Execute CREATE TABLE and store promise for awaiting before queries
            // Don't catch errors here - let them propagate when the promise is awaited
            const workerCreatedTables = getWorkerCreatedTables();
            const createPromise = (async () => {
              logger.debug('[PGlite] Worker executing CREATE TABLE', {
                workerId: getWorkerID(),
                tableName,
              });
              try {
                const result = await queryFn(createTableSQL, []);
                logger.debug('[PGlite] Worker successfully created table', {
                  workerId: getWorkerID(),
                  tableName,
                  result,
                });
              } catch (error) {
                // Remove from created set on failure so it can be retried
                workerCreatedTables.delete(tableName);
                logger.error(
                  '[PGlite] Worker FAILED to create table',
                  error instanceof Error ? error : new Error(String(error)),
                  { workerId: getWorkerID(), tableName },
                );
                defaultLogger.error(`Failed to create table ${tableName}:`, error);
                defaultLogger.error('SQL:', createTableSQL);
                throw error;
              }
            })();

            const pendingCreations = getWorkerPendingTableCreations();
            logger.debug('[PGlite] Worker added promise to pending queue', {
              workerId: getWorkerID(),
              tableName,
              totalPending: pendingCreations.length + 1,
            });
            pendingCreations.push(createPromise);
          }
        : undefined,

    // Create global table schema for PGlite provider
    createGlobalTable:
      config.provider === 'electric' ||
      !(
        config.connectionString ||
        config.envVar ||
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL ||
        process.env.SUPABASE_DATABASE_URI
      )
        ? (globalSlug: string, fields: Field[]) => {
            const tableName = `global_${globalSlug}`;
            const createdTables = getWorkerCreatedTables();

            // Skip if table was already created in this worker
            if (createdTables.has(tableName)) {
              return;
            }

            // Mark as created to prevent duplicates in this worker
            createdTables.add(tableName);

            // Build CREATE TABLE SQL statement for global
            const columns: string[] = [
              'id TEXT PRIMARY KEY', // TEXT to support both string IDs (rvl_*) and integer IDs
              'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
              'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
              '_status TEXT', // Draft/published status
              '_json JSONB', // Store complex field types (arrays, relationships with hasMany, etc.)
            ];

            // Add fields from global definition
            // Skip reserved columns (id, created_at, updated_at) as they're already added
            const reservedColumns = ['id', 'created_at', 'updated_at', 'createdAt', 'updatedAt'];
            for (const field of fields) {
              if ('name' in field && field.name && !reservedColumns.includes(field.name)) {
                let columnType = 'TEXT';

                // Map field types to PostgreSQL types
                if ('type' in field) {
                  switch (field.type) {
                    case 'number':
                      columnType = 'NUMERIC';
                      break;
                    case 'checkbox':
                      columnType = 'BOOLEAN';
                      break;
                    case 'date':
                      columnType = 'TIMESTAMP';
                      break;
                    case 'json':
                    case 'richText':
                    case 'array':
                    case 'blocks':
                      columnType = 'JSONB';
                      break;
                    default:
                      columnType = 'TEXT';
                  }
                }

                const required = 'required' in field && field.required ? 'NOT NULL' : '';
                columns.push(`"${field.name}" ${columnType} ${required}`.trim());
              }
            }

            const createTableSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns.join(', ')})`;

            // Execute CREATE TABLE and store promise for awaiting before queries
            // Don't catch errors here - let them propagate when the promise is awaited
            const workerCreatedTables = getWorkerCreatedTables();
            const createPromise = (async () => {
              try {
                await queryFn(createTableSQL, []);
              } catch (error) {
                // Remove from created set on failure so it can be retried
                workerCreatedTables.delete(tableName);
                defaultLogger.error(`Failed to create global table ${tableName}:`, error);
                defaultLogger.error('SQL:', createTableSQL);
                throw error;
              }
            })();

            const pendingCreations = getWorkerPendingTableCreations();
            pendingCreations.push(createPromise);
          }
        : undefined,
  };
}

/**
 * Clear all worker-specific PGlite instances and state (useful for test cleanup)
 * Only affects electric provider
 * Can optionally clear just the current worker or all workers
 */
export function clearGlobalPGlite(clearAllWorkers = false): void {
  if (clearAllWorkers) {
    // Clear all workers (for global cleanup)
    workerPGliteInstances.clear();
    workerPendingTableCreations.clear();
    workerCreatedTables.clear();
  } else {
    // Clear only current worker (for test isolation)
    const workerID = getWorkerID();
    workerPGliteInstances.delete(workerID);
    workerPendingTableCreations.delete(workerID);
    workerCreatedTables.delete(workerID);
  }
}

// Export as default for convenience
export default universalPostgresAdapter;
