/**
 * @revealui/db - Database Client
 *
 * Provides a configured Drizzle ORM client for PostgreSQL through node-postgres.
 * The Node runtime uses the PostgreSQL wire protocol for Neon and self-hosted
 * databases so transaction scopes can pin one connection.
 *
 * A single 'rest' database type selects this client. The legacy 'vector' type
 * (a holdover from the dual-DB Supabase era) was removed per
 * docs/decisions/2026-05-01-supabase-removal.md (GAP-129 PR-C).
 *
 * Connection String Format:
 * - NeonDB: postgresql://...@neon.tech/...
 * - Localhost (dev/test): postgresql://...@localhost:5432/...
 *
 * Reference:
 * - Neon: https://orm.drizzle.team/docs/connect-neon
 */

// Import config module (ESM)
// Config uses proxy for lazy loading, so import is safe - validation only happens on property access
// Direct ESM import - the Proxy ensures no validation occurs until properties are accessed
import configModule from '@revealui/config';
import { getSSLConfig } from '@revealui/utils/database';
import { logger } from '@revealui/utils/logger';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema/index.js'; // Full schema for backward compatibility
import type * as restSchema from '../schema/rest.js';
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
 *
 * The legacy 'vector' alias (a holdover from the dual-DB Supabase era) was
 * removed per GAP-129 PR-C; see docs/decisions/2026-05-01-supabase-removal.md.
 */
export type DatabaseType = 'rest';

/**
 * Database client type (Drizzle ORM client)
 *
 * This is the actual database client returned by createClient/getClient.
 * For the centralized Database type, see @revealui/db/types
 *
 * This client is backed by a node-postgres pool in the Node runtime.
 */
export type Database = NodePgDatabase<typeof schema>;
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DatabaseConfig {
  connectionString: string;
  logger?: boolean;
}

type DatabaseSchema = typeof restSchema | typeof vectorSchema | typeof schema;

// =============================================================================
// Client Creation
// =============================================================================

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
 * Creates a PostgreSQL wire-protocol Drizzle client for the Node runtime.
 *
 * @param config - Database configuration
 * @param dbSchema - Optional schema to use (defaults to full schema for backward compatibility)
 *
 * @example
 * ```typescript
 * import { createClient } from '@revealui/db/client'
 *
 * // Uses node-postgres for PostgreSQL connections in the Node runtime
 * const testDb = createClient({
 *   connectionString: 'postgresql://test:test@localhost:5432/test',
 * })
 *
 * // Uses the PostgreSQL wire protocol for NeonDB
 * const neonDb = createClient({
 *   connectionString: process.env.POSTGRES_URL!, // NeonDB URL
 * })
 * ```
 */
export function createClient(config: DatabaseConfig): Database;
export function createClient<TSchema extends DatabaseSchema>(
  config: DatabaseConfig,
  dbSchema: TSchema,
): NodePgDatabase<TSchema>;
export function createClient(
  config: DatabaseConfig,
  dbSchema: DatabaseSchema = schema,
): NodePgDatabase<DatabaseSchema> {
  const poolMax = parseInt(process.env.DB_POOL_MAX || '10', 10);
  const poolIdleTimeout = parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10);
  const pool = new Pool({
    connectionString: config.connectionString,
    ssl: getSSLConfig(config.connectionString),
    max: poolMax,
    idleTimeoutMillis: poolIdleTimeout,
    connectionTimeoutMillis: 10_000,
  });
  pool.on('error', onClientPoolError);
  activePools.set(`pool-${activePools.size + 1}`, pool);
  registerPoolCleanup();

  const client = drizzlePg({
    client: pool,
    schema: dbSchema,
    logger: config.logger ?? false,
  });
  databasePools.set(client, pool);
  return client;
}

// =============================================================================
// Global Client (for singleton usage)
// =============================================================================

let restClient: Database | null = null;

// The REST pool, stored for sharing with the CMS adapter (universal-postgres).
// When the admin app passes this pool to universalPostgresAdapter({ pool }),
// both systems use the same connection pool — eliminating dual-pool issues.
let restPool: Pool | null = null;

const databasePools = new WeakMap<object, Pool>();

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
  // Legacy API: If first argument is a string and not 'rest', treat as connection string
  if (typeOrConnectionString && typeof typeOrConnectionString === 'string') {
    if (typeOrConnectionString === 'rest') {
      // New API: Type specified
      return getClientByType();
    } else if (
      typeOrConnectionString.startsWith('postgresql://') ||
      typeOrConnectionString.startsWith('postgres://')
    ) {
      // Legacy API: Connection string provided, use as REST client
      if (!restClient) {
        restClient = createClient({ connectionString: typeOrConnectionString });
        restPool = databasePools.get(restClient) ?? null;
        restSupportsTransactions = restPool !== null;
      }
      return restClient;
    }
  }

  // Default to 'rest' for backward compatibility
  return getClientByType();
}

/**
 * Internal function to get (or lazily create) the single 'rest' client.
 */
/**
 * Resolve the database connection string EXACTLY the way `getClient()` will:
 * `@revealui/config` (lazy, process-global) first, then the `POSTGRES_URL` /
 * `DATABASE_URL` fallback (`||` also catches empty strings). The `env`
 * parameter covers only the env-var fallback — the config module always reads
 * the real process env, matching runtime behavior.
 */
function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  let url: string | undefined;
  try {
    const configUrl = configModule.database?.url;
    if (typeof configUrl === 'string') {
      url = configUrl;
    }
  } catch {
    // Config validation failed or module unavailable - will use env fallback
    url = undefined;
  }
  return url || env.POSTGRES_URL || env.DATABASE_URL || undefined;
}

/**
 * Whether `getClient()` would be able to construct a client from the current
 * environment. THE boot-time predicate for callers that must fail closed
 * before installing a DB-backed subsystem (GAP-417: the audit env assert
 * previously accepted `DATABASE_HOST`, which this resolution never consults,
 * so the assert passed and the install then threw — a silent fail-open).
 * Keep this and `getClientByType` on the same resolution, always.
 */
export function hasDatabaseConnectionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(resolveDatabaseUrl(env));
}

function getClientByType(): Database {
  if (!restClient) {
    const url = resolveDatabaseUrl();

    if (!url || typeof url !== 'string') {
      throw new Error(
        'Database connection string not provided for REST database. ' +
          'Either use @revealui/config, or set POSTGRES_URL (or DATABASE_URL) environment variable.',
      );
    }

    restClient = createClient({ connectionString: url }, schema);
    restPool = databasePools.get(restClient) ?? null;
    restSupportsTransactions = restPool !== null;
  }
  return restClient;
}

/**
 * Gets or creates the REST database client.
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
 * when no database connection is configured.
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
    const url = resolveDatabaseUrl();
    if (!url) return null;
    getClientByType();
  }
  return restPool;
}

/**
 * Run a callback on one checked-out PostgreSQL connection under a read-only,
 * repeatable-read transaction. The pool is the same one used by getRestClient
 * and the RevealUI PostgreSQL adapter.
 */
export async function withReadOnlyRepeatableRead<T>(
  callback: (transactionClient: Database) => Promise<T>,
): Promise<T> {
  const pool = getRestPool();
  if (!pool) {
    throw new Error('Read-only repeatable-read transactions require the PostgreSQL client pool');
  }

  const client = await pool.connect();
  let transactionAttempted = false;
  try {
    transactionAttempted = true;
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const transactionClient = drizzlePg({ client, schema, logger: false });
    const result = await callback(transactionClient);
    await client.query('COMMIT');
    transactionAttempted = false;
    return result;
  } catch (error) {
    if (transactionAttempted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error(
          'Database snapshot rollback failed after error',
          rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError)),
        );
      }
    }
    throw error;
  } finally {
    client.release();
  }
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
 * @param dbType - Database type to check ('rest')
 * @throws {Error} If the database driver does not support transactions
 *
 * @example
 * ```typescript
 * // At app startup
 * requiresTransactions('rest')
 * ```
 */
export function requiresTransactions(dbType: DatabaseType = 'rest'): void {
  // Force client creation so we know the driver type
  getClient(dbType);
  if (!restSupportsTransactions) {
    throw new Error(
      `Transaction support required but not available for '${dbType}' database. ` +
        'The PostgreSQL client pool is unavailable for transaction support.',
    );
  }
}

/**
 * Execute a database transaction with automatic BEGIN/COMMIT/ROLLBACK.
 *
 * @param db - PostgreSQL Drizzle client
 * @param fn - Transaction callback that receives a transaction context
 * @returns Result from the transaction callback
 * @throws {Error} If transaction fails (automatic ROLLBACK is performed)
 */
export async function withTransaction<T>(
  db: Database,
  fn: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(fn);
}

// =============================================================================
// Saga Helper (NeonDB-safe alternative to withTransaction)
// =============================================================================

/**
 * Execute a saga as a compensating alternative to withTransaction.
 *
 * withSaga models multi-step writes as individually atomic operations with
 * compensating actions for rollback.
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
