/**
 * @revealui/db - Database Client
 *
 * Provides a configured Drizzle ORM client for PostgreSQL databases.
 * Supports dual database architecture:
 * - REST Database (NeonDB): Uses @neondatabase/serverless with drizzle-orm/neon-http
 * - Vector Database (Supabase): Uses postgres-js with drizzle-orm/postgres-js
 *
 * This dual-driver approach avoids the Neon driver's compatibility issue with Supabase,
 * where it incorrectly transforms Supabase hostnames (aws-0-*.pooler.supabase.com → api.pooler.supabase.com).
 *
 * Connection String Format:
 * - NeonDB: postgresql://...@neon.tech/...
 * - Supabase: postgresql://...@*.supabase.co:6543/postgres (transaction pooler)
 * - Supabase: postgresql://...@*.supabase.co:5432/postgres (direct/session pooler)
 *
 * Reference:
 * - Neon: https://orm.drizzle.team/docs/connect-neon
 * - Supabase: https://orm.drizzle.team/docs/tutorials/drizzle-with-supabase
 */

import { neon } from '@neondatabase/serverless';
// Import config module (ESM)
// Config uses proxy for lazy loading, so import is safe - validation only happens on property access
// Direct ESM import - the Proxy ensures no validation occurs until properties are accessed
import configModule from '@revealui/config';
import { getSSLConfig } from '@revealui/utils/database';
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema/index.js'; // Full schema for backward compatibility
import * as restSchema from '../schema/rest.js';
import * as vectorSchema from '../schema/vector.js';

// Monitoring integration is handled by the application layer to avoid
// circular dependency (db <-> core)

// Define PoolMetrics type locally to avoid circular dependency
// This matches the type from @revealui/core/monitoring
export interface PoolMetrics {
  /** Total connections in pool */
  totalCount: number;
  /** Idle connections */
  idleCount: number;
  /** Waiting requests */
  waitingCount: number;
  /** Pool name/identifier */
  name: string;
}

// =============================================================================
// Transaction Support Tracking
// =============================================================================

let restSupportsTransactions = false;
let vectorSupportsTransactions = false;

// =============================================================================
// Types
// =============================================================================

/**
 * Database type selector for dual database architecture
 * - 'rest': NeonDB for transactional REST API operations
 * - 'vector': Supabase for vector search operations
 */
export type DatabaseType = 'rest' | 'vector';

/**
 * Database client type (Drizzle ORM client)
 *
 * This is the actual database client returned by createClient/getClient.
 * For the centralized Database type matching Supabase structure, see @revealui/db/types
 *
 * Note: This is a union type to support both Neon (REST) and Postgres (Vector) drivers.
 * The actual type will be NeonHttpDatabase for REST and PgDatabase for Vector.
 */
export type Database = NeonHttpDatabase<typeof schema> | NodePgDatabase<typeof schema>;

export interface DatabaseConfig {
  connectionString: string;
  logger?: boolean;
}

// =============================================================================
// Client Creation
// =============================================================================

/**
 * Creates a Drizzle database client for Neon Postgres.
 *
 * Uses the official Drizzle pattern for neon-http driver:
 * https://orm.drizzle.team/docs/connect-neon
 *
 * @param config - Database configuration
 * @param dbSchema - Optional schema to use (defaults to full schema for backward compatibility)
 *
 * @example
 * ```typescript
 * import { createClient } from '@revealui/db/client'
 *
 * const db = createClient({
 *   connectionString: process.env.POSTGRES_URL!,
 * })
 *
 * // Query users
 * const users = await db.query.users.findMany()
 * ```
 */
/**
 * Detects if a connection string requires node-postgres driver.
 * Returns true for Supabase connections and localhost/test connections.
 * Supabase connection strings contain '.supabase.co' or 'pooler.supabase.com'.
 * Localhost connections are used for testing and development.
 */
function isSupabaseConnection(connectionString: string): boolean {
  try {
    const host = new URL(connectionString).hostname;
    return (
      host.endsWith('.supabase.co') ||
      host === 'supabase.co' ||
      host.endsWith('.supabase.com') ||
      host === 'supabase.com' ||
      host === 'localhost' ||
      host === '127.0.0.1'
    );
  } catch {
    // Fallback for non-URL connection strings (e.g., plain host:port format)
    return (
      connectionString.includes('.supabase.co') ||
      connectionString.includes('pooler.supabase.com') ||
      connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1')
    );
  }
}

/**
 * Creates a Drizzle database client, automatically selecting the appropriate driver:
 * - Supabase/localhost connections: Uses node-postgres with drizzle-orm/node-postgres
 * - NeonDB connections: Uses @neondatabase/serverless with drizzle-orm/neon-http
 *
 * This dual-driver approach fixes the Neon driver's compatibility issue with Supabase,
 * where it incorrectly transforms Supabase hostnames. It also enables local testing
 * with localhost PostgreSQL databases.
 *
 * @param config - Database configuration
 * @param dbSchema - Optional schema to use (defaults to full schema for backward compatibility)
 *
 * @example
 * ```typescript
 * import { createClient } from '@revealui/db/client'
 *
 * // Automatically uses node-postgres for Supabase
 * const supabaseDb = createClient({
 *   connectionString: process.env.DATABASE_URL!, // Supabase URL
 * })
 *
 * // Automatically uses node-postgres for localhost (testing)
 * const testDb = createClient({
 *   connectionString: 'postgresql://test:test@localhost:5432/test',
 * })
 *
 * // Automatically uses Neon driver for NeonDB
 * const neonDb = createClient({
 *   connectionString: process.env.POSTGRES_URL!, // NeonDB URL
 * })
 * ```
 */
export function createClient(
  config: DatabaseConfig,
  dbSchema: typeof restSchema | typeof vectorSchema | typeof schema = schema,
): Database {
  const isSupabase = isSupabaseConnection(config.connectionString);

  if (isSupabase) {
    // Use pg for Supabase connections
    // This avoids the Neon driver's hostname transformation bug
    const poolMax = parseInt(process.env.DB_POOL_MAX || '10', 10);
    const poolIdleTimeout = parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10);

    const pool = new Pool({
      connectionString: config.connectionString,
      ssl: getSSLConfig(config.connectionString), // Auto-detect SSL from connection string
      max: poolMax,
      idleTimeoutMillis: poolIdleTimeout,
      connectionTimeoutMillis: 10_000, // 10 seconds
    });

    // Track pool and register cleanup
    const poolId = `pool-${activePools.size + 1}`;
    activePools.set(poolId, pool);
    registerPoolCleanup();

    return drizzlePg({
      client: pool,
      schema: dbSchema,
      logger: config.logger ?? false,
    }) as Database;
  } else {
    // Use Neon serverless driver for NeonDB connections
    const sql = neon(config.connectionString);

    return drizzleNeon({
      client: sql,
      schema: dbSchema,
      logger: config.logger ?? false,
    }) as Database;
  }
}

// =============================================================================
// Global Client (for singleton usage)
// =============================================================================

let restClient: Database | null = null;
let vectorClient: Database | null = null;

// Track all pg.Pool instances for monitoring and cleanup
const activePools: Map<string, Pool> = new Map();

// Register cleanup handler
let cleanupHandlerRegistered = false;
function registerPoolCleanup() {
  if (cleanupHandlerRegistered) return;

  // Monitoring integration removed to avoid circular dependency
  // Application layer should handle cleanup registration instead
  // const monitoring = await getMonitoring()
  // if (monitoring?.registerCleanupHandler) {
  //   monitoring.registerCleanupHandler(
  //     'database-pools',
  //     async () => {
  //       await closeAllPools()
  //     },
  //     'Close all database connection pools',
  //     100, // High priority
  //   )
  // }

  cleanupHandlerRegistered = true;
}

/**
 * Gets or creates a global database client.
 * Supports dual database architecture with separate clients for REST and Vector operations.
 * Uses config module if available, otherwise falls back to process.env for backward compatibility.
 *
 * @param typeOrConnectionString - Database type ('rest' | 'vector') or connection string (legacy API)
 * @returns Database client instance
 *
 * @example
 * ```typescript
 * import { getClient } from '@revealui/db/client'
 *
 * // New API: Specify database type
 * const restDb = getClient('rest')
 * const vectorDb = getClient('vector')
 *
 * // Legacy API: Still supported for backward compatibility
 * const db = getClient() // defaults to 'rest'
 * const db2 = getClient('postgresql://...') // uses provided connection string as 'rest'
 * ```
 */
// Note: DatabaseType | string union is intentional for backward compatibility (allows both type strings and connection strings)
export function getClient(typeOrConnectionString?: DatabaseType | string): Database {
  // Legacy API: If first argument is a string and not 'rest' or 'vector', treat as connection string
  if (typeOrConnectionString && typeof typeOrConnectionString === 'string') {
    if (typeOrConnectionString === 'rest' || typeOrConnectionString === 'vector') {
      // New API: Type specified
      const type = typeOrConnectionString as DatabaseType;
      return getClientByType(type);
    } else if (
      typeOrConnectionString.startsWith('postgresql://') ||
      typeOrConnectionString.startsWith('postgres://')
    ) {
      // Legacy API: Connection string provided, use as REST client
      if (!restClient) {
        restClient = createClient({ connectionString: typeOrConnectionString });
      }
      return restClient;
    }
  }

  // Default to 'rest' for backward compatibility
  return getClientByType('rest');
}

/**
 * Internal function to get client by type
 */
function getClientByType(type: DatabaseType): Database {
  if (type === 'vector') {
    if (!vectorClient) {
      const url = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
      if (!url || typeof url !== 'string') {
        throw new Error(
          'SUPABASE_DATABASE_URL environment variable is required for vector database. ' +
            'Set SUPABASE_DATABASE_URL to your Supabase connection string.',
        );
      }
      vectorClient = createClient({ connectionString: url }, vectorSchema);
      vectorSupportsTransactions = isSupabaseConnection(url);
    }
    return vectorClient;
  }

  // type === 'rest'
  if (!restClient) {
    // Try to get from config module (ESM - lazy validation via Proxy)
    let url: string | undefined;
    try {
      const configUrl = configModule.database?.url;
      if (typeof configUrl === 'string') {
        url = configUrl;
      }
    } catch {
      // Config validation failed or module unavailable - will use process.env fallback
      url = undefined;
    }

    // Fallback to process.env (use || to also catch empty strings)
    url = url || process.env.POSTGRES_URL || process.env.DATABASE_URL;

    if (!url || typeof url !== 'string') {
      throw new Error(
        'Database connection string not provided for REST database. ' +
          'Either use @revealui/config, or set POSTGRES_URL (or DATABASE_URL) environment variable.',
      );
    }

    restClient = createClient({ connectionString: url }, restSchema);
    restSupportsTransactions = isSupabaseConnection(url);
  }
  return restClient;
}

/**
 * Gets or creates the REST database client (NeonDB).
 * Convenience function for accessing the REST database.
 *
 * @example
 * ```typescript
 * import { getRestClient } from '@revealui/db/client'
 *
 * const db = getRestClient()
 * const users = await db.query.users.findMany()
 * ```
 */
export function getRestClient(): Database {
  return getClient('rest');
}

/**
 * Gets or creates the Vector database client (Supabase).
 * Convenience function for accessing the vector database.
 *
 * @example
 * ```typescript
 * import { getVectorClient } from '@revealui/db/client'
 *
 * const db = getVectorClient()
 * const memories = await db.query.agentMemories.findMany()
 * ```
 */
export function getVectorClient(): Database {
  return getClient('vector');
}

/**
 * Resets the global clients (useful for testing).
 * Clears both REST and Vector client instances.
 */
export function resetClient(): void {
  restClient = null;
  vectorClient = null;
  restSupportsTransactions = false;
  vectorSupportsTransactions = false;
}

// =============================================================================
// Pool Monitoring and Cleanup
// =============================================================================

/**
 * Gets metrics for all active database connection pools.
 *
 * @returns Array of pool metrics
 *
 * @example
 * ```typescript
 * import { getPoolMetrics } from '@revealui/db/client'
 *
 * const metrics = getPoolMetrics()
 * for (const pool of metrics) {
 *   // Log pool statistics
 *   logger.info(`${pool.name}: ${pool.totalCount} total, ${pool.idleCount} idle`)
 * }
 * ```
 */
export function getPoolMetrics(): PoolMetrics[] {
  const metrics: PoolMetrics[] = [];

  for (const [name, pool] of activePools) {
    metrics.push({
      name,
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    });
  }

  return metrics;
}

/**
 * Closes all active database connection pools.
 * This should be called during graceful shutdown.
 *
 * @example
 * ```typescript
 * import { closeAllPools } from '@revealui/db/client'
 *
 * process.on('SIGTERM', async () => {
 *   await closeAllPools()
 *   process.exit(0)
 * })
 * ```
 */
export async function closeAllPools(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  for (const [_name, pool] of activePools) {
    closePromises.push(
      pool.end().catch((_error) => {
        // Silently handle pool close errors during shutdown
        // Pool is being removed from activePools regardless
      }),
    );
  }

  await Promise.all(closePromises);
  activePools.clear();

  // Reset global clients
  restClient = null;
  vectorClient = null;
}

// =============================================================================
// Transaction Helper
// =============================================================================

/**
 * Execute a database transaction with automatic BEGIN/COMMIT/ROLLBACK.
 *
 * ⚠️ IMPORTANT: Transaction support depends on the database driver:
 * - ✅ Supabase/localhost (pg Pool): Full transaction support
 * - ❌ NeonDB (HTTP driver): Transactions NOT supported
 *
 * The Neon HTTP driver (@neondatabase/serverless with neon-http) does not support
 * transactions because it uses stateless HTTP requests. Each query is independent.
 *
 * For transaction support, use:
 * 1. Supabase with connection pooling (recommended for production)
 * 2. Localhost PostgreSQL (for development/testing)
 * 3. Neon with WebSocket driver (coming in future versions)
 *
 * @param db - Database client (must be created with pg Pool driver)
 * @param fn - Transaction callback that receives a transaction context
 * @returns Result from the transaction callback
 * @throws {Error} If using Neon HTTP driver (no transaction support)
 * @throws {Error} If transaction fails (automatic ROLLBACK is performed)
 *
 * @example
 * ```typescript
 * // ✅ Works with Supabase/localhost (pg Pool driver)
 * const supabaseDb = getClient('vector') // Uses pg Pool
 * const result = await withTransaction(supabaseDb, async (tx) => {
 *   const site = await tx.insert(sites).values({ ... }).returning()
 *   await tx.insert(pages).values({ siteId: site[0].id, ... })
 *   return site[0]
 * })
 *
 * // ❌ Throws error with NeonDB (HTTP driver)
 * const neonDb = getClient('rest') // Uses Neon HTTP
 * await withTransaction(neonDb, async (tx) => { ... }) // Error!
 * ```
 */
/**
 * Asserts that a database type supports transactions. Call at app startup to fail fast.
 *
 * @param dbType - Database type to check ('rest' or 'vector')
 * @throws {Error} If the database driver does not support transactions
 *
 * @example
 * ```typescript
 * // At app startup
 * requiresTransactions('rest') // throws if REST DB is Neon HTTP
 * ```
 */
export function requiresTransactions(dbType: DatabaseType = 'rest'): void {
  // Force client creation so we know the driver type
  getClient(dbType);
  const supports = dbType === 'vector' ? vectorSupportsTransactions : restSupportsTransactions;
  if (!supports) {
    throw new Error(
      `Transaction support required but not available for '${dbType}' database. ` +
        'The Neon HTTP driver does not support transactions. ' +
        'Switch to Supabase pooler or pg driver for transaction support.',
    );
  }
}

export async function withTransaction<T>(
  db: Database,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  // Early check: fail fast with clear message based on tracked driver type
  if (db === restClient && !restSupportsTransactions) {
    throw new Error(
      'Transaction not supported: REST database is using Neon HTTP driver. ' +
        'Use withSaga() for NeonDB-safe multi-step writes, or switch to Supabase pooler / pg driver for transaction support.',
    );
  }
  if (db === vectorClient && !vectorSupportsTransactions) {
    throw new Error(
      'Transaction not supported: Vector database is using Neon HTTP driver. ' +
        'Use withSaga() for NeonDB-safe multi-step writes, or switch to Supabase pooler / pg driver for transaction support.',
    );
  }

  // Fallback: Check if this is a pg Pool-based client (supports transactions)
  const hasPgTransaction = 'transaction' in db && typeof db.transaction === 'function';

  if (!hasPgTransaction) {
    throw new Error(
      'Transaction not supported: Database client is using Neon HTTP driver which does not support transactions. ' +
        'Use withSaga() for NeonDB-safe multi-step writes, or configure your database with Supabase / localhost connection string. ' +
        'Neon HTTP driver uses stateless requests and cannot maintain transaction state.',
    );
  }

  // Use Drizzle's built-in transaction API
  // This automatically handles BEGIN/COMMIT/ROLLBACK
  return (db as NodePgDatabase<typeof schema>).transaction(
    fn as (tx: NodePgDatabase<typeof schema>) => Promise<T>,
  );
}

// =============================================================================
// Saga Helper (NeonDB-safe alternative to withTransaction)
// =============================================================================

/**
 * Execute a saga — a NeonDB-safe alternative to withTransaction.
 *
 * Unlike withTransaction (which requires a pg Pool driver), withSaga works
 * with the NeonDB HTTP driver by modeling multi-step writes as individually
 * atomic operations with compensating actions for rollback.
 *
 * @see executeSaga in ../saga/neon-saga.ts for full documentation
 */
export { executeSaga as withSaga } from '../saga/neon-saga.js';

// =============================================================================
// Re-exports
// =============================================================================

// Re-export individual table types
export type {
  AgentAction,
  AgentContext,
  AgentMemory,
  Conversation,
  CRDTOperation,
  GlobalFooter,
  GlobalHeader,
  GlobalSettings,
  Media,
  NewAgentAction,
  NewAgentContext,
  NewAgentMemory,
  NewConversation,
  NewCRDTOperation,
  NewGlobalFooter,
  NewGlobalHeader,
  NewGlobalSettings,
  NewMedia,
  NewNodeIdMapping,
  NewPage,
  NewPageRevision,
  NewPost,
  NewSession,
  NewSite,
  NewSiteCollaborator,
  NewUser,
  NodeIdMapping,
  Page,
  PageRevision,
  Post,
  Session,
  Site,
  SiteCollaborator,
  User,
} from '../schema/index.js';
// Re-export type utilities
export type {
  Database as DatabaseSchema,
  DatabaseClient,
  QueryResult,
  QueryResults,
  RelatedTables,
  TableRelationships,
  Transaction,
} from './types.js';
export { schema };
