/**
 * @revealui/db - Database Client
 *
 * Provides a configured Drizzle ORM client for a single PostgreSQL database (Neon-primary).
 * Uses @neondatabase/serverless with drizzle-orm/neon-http for Neon connections.
 * Uses node-postgres (pg Pool) with drizzle-orm/node-postgres for localhost / 127.0.0.1
 * connections (development and test environments).
 *
 * The 'vector' database type resolves to the same single client as 'rest' following Supabase
 * removal per docs/decisions/2026-05-01-supabase-removal.md (GAP-129 PR-C).
 *
 * Connection String Format:
 * - NeonDB: postgresql://...@neon.tech/...
 * - Localhost (dev/test): postgresql://...@localhost:5432/...
 *
 * Reference:
 * - Neon: https://orm.drizzle.team/docs/connect-neon
 */

import { neon } from '@neondatabase/serverless';
// Import config module (ESM)
// Config uses proxy for lazy loading, so import is safe - validation only happens on property access
// Direct ESM import - the Proxy ensures no validation occurs until properties are accessed
import configModule from '@revealui/config';
import { getSSLConfig } from '@revealui/utils/database';
import { logger } from '@revealui/utils/logger';
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema/index.js'; // Full schema for backward compatibility
import * as restSchema from '../schema/rest.js';
import type * as vectorSchema from '../schema/vector.js';

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

// =============================================================================
// Types
// =============================================================================

/**
 * Database type selector.
 * - 'rest': Neon-primary Postgres connection
 * - 'vector': deprecated alias for 'rest'; will be removed after 1-2 release cycles (GAP-129 PR-C)
 */
export type DatabaseType = 'rest' | 'vector';

/**
 * Database client type (Drizzle ORM client)
 *
 * This is the actual database client returned by createClient/getClient.
 * For the centralized Database type, see @revealui/db/types
 *
 * Note: This is a union type to support both Neon (cloud) and Postgres (localhost dev) drivers.
 * The actual type is NeonHttpDatabase for cloud Neon connections and NodePgDatabase for
 * localhost connections (where the pg driver is used for transaction support).
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
 * Returns true when the connection string targets a Postgres endpoint we should
 * reach with the standard `pg` (node-postgres) driver rather than the Neon HTTP
 * driver. The Neon HTTP driver speaks a Neon-specific protocol and fails
 * silently against vanilla Postgres (errors surface as empty `NeonDbError`).
 *
 * Default to `pg` for anything that isn't an explicit Neon endpoint. This makes
 * self-hosted Fleet kits, RDS, Supabase Postgres, docker-compose stacks, and
 * any other self-hosted Postgres work out of the box. Only `*.neon.tech`
 * hosts (or `wss://` Neon WebSocket endpoints) route through the Neon driver.
 */
function isLocalhostConnection(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    // Any non-Neon host should use pg — Neon HTTP driver requires a Neon endpoint.
    return !host.endsWith('.neon.tech') && url.protocol !== 'wss:';
  } catch {
    return !(connectionString.includes('.neon.tech') || connectionString.startsWith('wss://'));
  }
}

/**
 * Logs an unexpected error emitted by an idle pg pool client.
 *
 * pg `Pool` is an EventEmitter: an unhandled `'error'` event — emitted when an
 * idle connection is dropped by the server (admin termination, autosuspend,
 * network blip) — throws and crashes the process. Attaching a listener keeps the
 * pool alive and surfaces the error instead. Mirrors `onPoolError` in `../pool.ts`.
 */
function onClientPoolError(err: unknown): void {
  logger.error(
    'Unexpected error on idle database pool client',
    err instanceof Error ? err : new Error(String(err)),
  );
}

/**
 * Creates a Drizzle database client, automatically selecting the appropriate driver:
 * - Localhost connections: Uses node-postgres with drizzle-orm/node-postgres (dev/test)
 * - All other connections: Uses @neondatabase/serverless with drizzle-orm/neon-http (Neon-primary)
 *
 * @param config - Database configuration
 * @param dbSchema - Optional schema to use (defaults to full schema for backward compatibility)
 *
 * @example
 * ```typescript
 * import { createClient } from '@revealui/db/client'
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
  const isLocalhost = isLocalhostConnection(config.connectionString);

  if (isLocalhost) {
    // Use pg for localhost connections — Neon HTTP driver requires a Neon endpoint
    const poolMax = parseInt(process.env.DB_POOL_MAX || '10', 10);
    const poolIdleTimeout = parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10);

    const pool = new Pool({
      connectionString: config.connectionString,
      ssl: getSSLConfig(config.connectionString), // Auto-detect SSL from connection string
      max: poolMax,
      idleTimeoutMillis: poolIdleTimeout,
      connectionTimeoutMillis: 10_000, // 10 seconds
    });
    // Prevent an idle-client error from crashing the process (unhandled 'error' event).
    pool.on('error', onClientPoolError);

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

// The REST pool, stored for sharing with the CMS adapter (universal-postgres).
// When the admin app passes this pool to universalPostgresAdapter({ pool }),
// both systems use the same connection pool — eliminating dual-pool issues.
let restPool: Pool | null = null;

// Track all pg.Pool instances for monitoring and cleanup
const activePools: Map<string, Pool> = new Map();

// Register cleanup handler for graceful shutdown.
// Skipped in the test suite: vi.resetModules() re-executes this module on
// every import, and the module-level guard resets each time — causing one
// new SIGTERM/SIGINT/beforeExit listener per reimport cycle.  Signal
// cleanup is not meaningful in the vitest worker anyway.
let cleanupHandlerRegistered = false;
function registerPoolCleanup() {
  if (process.env.VITEST) return;
  if (cleanupHandlerRegistered) return;

  const shutdown = async () => {
    await closeAllPools();
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  process.once('beforeExit', shutdown);

  cleanupHandlerRegistered = true;
}

/**
 * Gets or creates a global database client (single Neon-primary Postgres connection).
 * Uses config module if available, otherwise falls back to process.env for backward compatibility.
 *
 * @param typeOrConnectionString - Database type ('rest') or connection string (legacy API).
 *   'vector' is a deprecated alias for 'rest' (GAP-129 PR-C); prefer 'rest' in new code.
 * @returns Database client instance
 *
 * @example
 * ```typescript
 * import { getClient } from '@revealui/db/client'
 *
 * const db = getClient('rest')
 * const db2 = getClient() // defaults to 'rest'
 * const db3 = getClient('postgresql://...') // legacy: connection string as 'rest'
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
 * Internal function to get client by type.
 * 'vector' is aliased to 'rest' (Supabase removed per GAP-129 PR-C).
 */
function getClientByType(type: DatabaseType): Database {
  if (type === 'vector') {
    return getClientByType('rest');
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

    // For pg-backed connections (localhost), create the pool
    // externally so it can be shared with the CMS adapter via getRestPool().
    if (isLocalhostConnection(url)) {
      const poolMax = parseInt(process.env.DB_POOL_MAX || '10', 10);
      const poolIdleTimeout = parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10);
      const pool = new Pool({
        connectionString: url,
        ssl: getSSLConfig(url),
        max: poolMax,
        idleTimeoutMillis: poolIdleTimeout,
        connectionTimeoutMillis: 10_000,
      });
      // Prevent an idle-client error from crashing the process (unhandled 'error' event).
      pool.on('error', onClientPoolError);
      restPool = pool;
      const poolId = `rest-pool`;
      activePools.set(poolId, pool);
      registerPoolCleanup();
      restClient = drizzlePg({
        client: pool,
        schema: restSchema,
        logger: false,
      }) as unknown as Database;
    } else {
      restClient = createClient({ connectionString: url }, restSchema);
    }
    restSupportsTransactions = isLocalhostConnection(url);
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
 * Resets the global client (useful for testing).
 */
export function resetClient(): void {
  restClient = null;
  restPool = null;
  restSupportsTransactions = false;
}

/**
 * Returns the underlying pg.Pool used by the REST database client, or null
 * if the REST client uses Neon serverless (which has no pg.Pool).
 *
 * Pass this to `universalPostgresAdapter({ pool })` in revealui.config.ts
 * so both the CMS adapter and Drizzle ORM share a single connection pool.
 * This eliminates the dual-pool architecture that caused session/write
 * visibility bugs when env vars were overridden (e.g., probe DB setup).
 */
export function getRestPool(): Pool | null {
  // Force initialization if not yet done — but only if a DB URL is available.
  // During Next.js build in CI, no DB URL exists and getClientByType would throw.
  // Return null gracefully so the caller falls back to its own pool creation.
  if (!restClient) {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!url) return null;
    try {
      getClientByType('rest');
    } catch {
      return null;
    }
  }
  return restPool;
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

  // Reset global client
  restClient = null;
}

// =============================================================================
// Transaction Helper
// =============================================================================

/**
 * Asserts that the database supports transactions. Call at app startup to fail fast.
 *
 * @param dbType - Database type to check ('rest', or deprecated 'vector' alias)
 * @throws {Error} If the database driver does not support transactions
 *
 * @example
 * ```typescript
 * // At app startup
 * requiresTransactions('rest') // throws if DB is Neon HTTP
 * ```
 */
export function requiresTransactions(dbType: DatabaseType = 'rest'): void {
  // Force client creation so we know the driver type
  getClient(dbType);
  if (!restSupportsTransactions) {
    throw new Error(
      `Transaction support required but not available for '${dbType}' database. ` +
        'The Neon HTTP driver does not support transactions. ' +
        'Use a localhost pg driver for transaction support.',
    );
  }
}

/**
 * Execute a database transaction with automatic BEGIN/COMMIT/ROLLBACK.
 *
 * ⚠️ IMPORTANT: Transaction support depends on the database driver:
 * - ✅ Localhost (pg Pool): Full transaction support (dev/test)
 * - ❌ NeonDB (HTTP driver): Transactions NOT supported
 *
 * The Neon HTTP driver (@neondatabase/serverless with neon-http) does not support
 * transactions because it uses stateless HTTP requests. Each query is independent.
 * Use withSaga() for NeonDB-safe multi-step writes.
 *
 * @param db - Database client (must be created with pg Pool driver)
 * @param fn - Transaction callback that receives a transaction context
 * @returns Result from the transaction callback
 * @throws {Error} If using Neon HTTP driver (no transaction support)
 * @throws {Error} If transaction fails (automatic ROLLBACK is performed)
 */
export async function withTransaction<T>(
  db: Database,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  // Early check: fail fast with clear message based on tracked driver type
  if (db === restClient && !restSupportsTransactions) {
    throw new Error(
      'Transaction not supported: database is using Neon HTTP driver. ' +
        'Use withSaga() for NeonDB-safe multi-step writes, or use a localhost pg driver for transaction support.',
    );
  }

  // Fallback: Check if this is a pg Pool-based client (supports transactions)
  const hasPgTransaction = 'transaction' in db && typeof db.transaction === 'function';

  if (!hasPgTransaction) {
    throw new Error(
      'Transaction not supported: database client is using Neon HTTP driver which does not support transactions. ' +
        'Use withSaga() for NeonDB-safe multi-step writes, or use a localhost pg driver. ' +
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
 * Execute a saga  -  a NeonDB-safe alternative to withTransaction.
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
