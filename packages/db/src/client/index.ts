/**
 * @revealui/db - Database Client
 *
 * Provides a configured Drizzle ORM client for a single PostgreSQL database (Neon-primary).
 * Uses @neondatabase/serverless with drizzle-orm/neon-http for Neon connections.
 * Uses node-postgres (pg Pool) with drizzle-orm/node-postgres for localhost / 127.0.0.1
 * connections (development and test environments).
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

import { AsyncLocalStorage } from 'node:async_hooks';
import { neon } from '@neondatabase/serverless';
// Import config module (ESM)
// Config uses proxy for lazy loading, so import is safe - validation only happens on property access
// Direct ESM import - the Proxy ensures no validation occurs until properties are accessed
import configModule from '@revealui/config';
import { getSSLConfig } from '@revealui/utils/database';
import { logger } from '@revealui/utils/logger';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core/session';
import type { ExtractTablesWithRelations } from 'drizzle-orm/relations';
import { Pool, type PoolClient } from 'pg';
import * as schema from '../schema/index.js'; // Full schema for backward compatibility
import * as restSchema from '../schema/rest.js';

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
 * Public query-builder surface shared by the HTTP and node-postgres clients.
 * Callback transaction transport is resolved internally by withTransaction;
 * exposing a driver union makes common Drizzle builders unusable at call sites.
 */
/**
 * The public database contract uses the canonical schema barrel. The rest and
 * vector schema objects are subsets/alternate projections used at runtime;
 * unioning their object types here makes Drizzle's relational query map
 * optional and erases selected columns to `unknown` for every consumer.
 */
type DatabaseSchema = typeof schema | typeof restSchema;
type DatabaseFor<TSchema extends DatabaseSchema> = PgDatabase<
  PgQueryResultHKT,
  TSchema,
  ExtractTablesWithRelations<TSchema>
>;
type FullDatabase = DatabaseFor<typeof schema>;
export type Database = DatabaseFor<typeof restSchema>;

export interface DatabaseConfig {
  connectionString: string;
  logger?: boolean;
  /** Use the maintained PostgreSQL pool when a callback transaction is required. */
  transactions?: boolean;
  /** Supported per-client pool capacity; otherwise the shared DB_POOL_MAX setting applies. */
  poolMax?: number;
}

type OwnedClient = {
  config: DatabaseConfig;
  dbSchema: DatabaseSchema;
  pool?: Pool;
  transactionClient?: Database;
};
const ownedClients = new WeakMap<object, OwnedClient>();

type TransactionScope = {
  pool: Pool;
  connection: PoolClient;
  transaction: Database;
  active: boolean;
  pending: Promise<void>;
};
const transactionScope = new AsyncLocalStorage<TransactionScope>();

/** Borrow the active owning lease; callers must never release this connection. */
export function getTransactionConnection(pool: Pool): PoolClient | null {
  const scope = transactionScope.getStore();
  return scope?.active && scope.pool === pool ? scope.connection : null;
}

/** Adapter seam for the same lease and serialized, rollback-safe nested transactions. */
export function getTransactionContext(pool: Pool): {
  connection: PoolClient;
  transaction<T>(fn: (connection: PoolClient) => Promise<T>): Promise<T>;
} | null {
  const scope = transactionScope.getStore();
  if (!scope?.active || scope.pool !== pool) return null;
  return {
    connection: scope.connection,
    transaction: (fn) => {
      if (!scope.active) return Promise.reject(new Error('Database transaction scope has ended'));
      return transactionScope.run(scope, () =>
        withTransaction(scope.transaction, async () => fn(scope.connection)),
      );
    },
  };
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
 * - Neon connections: Uses @neondatabase/serverless with drizzle-orm/neon-http
 * - Callback transactions: Uses the maintained pg pool for the captured database
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
export function createClient(config: DatabaseConfig): FullDatabase;
export function createClient<TSchema extends DatabaseSchema>(
  config: DatabaseConfig,
  dbSchema: TSchema,
): DatabaseFor<TSchema>;
export function createClient(
  config: DatabaseConfig,
  dbSchema: DatabaseSchema = schema,
): DatabaseFor<DatabaseSchema> {
  const isLocalhost = isLocalhostConnection(config.connectionString);

  if (isLocalhost || config.transactions) {
    // The same maintained pool handles ordinary Postgres and Neon callback transactions.
    const poolMax = config.poolMax ?? Number(process.env.DB_POOL_MAX || '10');
    if (!Number.isSafeInteger(poolMax) || poolMax < 1)
      throw new Error('Database pool capacity must be a positive safe integer');
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

    const client = drizzlePg({
      client: pool,
      schema: dbSchema,
      logger: config.logger ?? false,
    });
    ownedClients.set(client, { config: { ...config }, dbSchema, pool });
    return client;
  } else {
    // Use Neon serverless driver for NeonDB connections
    const sql = neon(config.connectionString);

    const client = drizzleNeon({
      client: sql,
      schema: dbSchema,
      logger: config.logger ?? false,
    });
    ownedClients.set(client, { config: { ...config }, dbSchema });
    return client;
  }
}

/** Create a client with the REST database contract and its matching schema. */
export function createRestClient(config: DatabaseConfig): Database {
  return createClient(config, restSchema);
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
        restClient = createClient({ connectionString: typeOrConnectionString }, restSchema);
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

    restClient = createClient({ connectionString: url }, restSchema);
    restPool = ownedClients.get(restClient)?.pool ?? null;
  }
  const scope = transactionScope.getStore();
  const owned = ownedClients.get(restClient);
  const pool =
    owned?.pool ?? (owned?.transactionClient && ownedClients.get(owned.transactionClient)?.pool);
  return scope?.active && scope.pool === pool ? scope.transaction : restClient;
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
}

/** Resolve callback transactions through the same captured configuration and pool owner. */
function getTransactionClient(db: Database): Database {
  const owned = ownedClients.get(db);
  if (!owned || owned.pool) return db;
  const cached = owned.transactionClient;
  const cachedPool = cached ? ownedClients.get(cached)?.pool : undefined;
  if (cached && cachedPool && [...activePools.values()].includes(cachedPool)) return cached;
  owned.transactionClient = createClient({ ...owned.config, transactions: true }, restSchema);
  return owned.transactionClient;
}

/**
 * Share the maintained PostgreSQL pool with the CMS adapter. Neon HTTP queries
 * retain their normal transport; callback transactions and CMS use one pool
 * bound to the identical captured database URL, SSL and lifecycle owner.
 */
export function getRestPool(): Pool | null {
  if (!restClient) {
    if (!resolveDatabaseUrl()) return null;
    getClientByType();
  }
  if (!restClient) return null;
  const transactionClient = getTransactionClient(restClient);
  restPool = ownedClients.get(transactionClient)?.pool ?? null;
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
  resetClient();
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
 * requiresTransactions('rest') // resolves the maintained transaction transport
 * ```
 */
export function requiresTransactions(dbType: DatabaseType = 'rest'): void {
  const client = getTransactionClient(getClient(dbType));
  if (typeof client.transaction !== 'function') {
    throw new Error(`Transaction support required but not available for '${dbType}' database.`);
  }
}

/**
 * Execute a database transaction with automatic BEGIN/COMMIT/ROLLBACK.
 *
 * ⚠️ IMPORTANT: Transaction support depends on the database driver:
 * - ✅ Localhost (pg Pool): Full transaction support (dev/test)
 * - ✅ NeonDB: normal reads use HTTP; callback transactions use the managed pg pool
 *
 * The Neon HTTP driver (@neondatabase/serverless with neon-http) does not support
 * transactions because it uses stateless HTTP requests. Each query is independent.
 * Owned clients resolve callback transactions to the same captured database via
 * the maintained pg pool. Unowned clients must expose their own transaction API.
 *
 * @param db - Owned database client, or an injected transaction-capable client
 * @param fn - Transaction callback that receives a transaction context
 * @returns Result from the transaction callback
 * @throws {Error} If an unowned client cannot provide callback transactions
 * @throws {Error} If transaction fails (automatic ROLLBACK is performed)
 */
export async function withTransaction<T>(
  db: Database,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  db = getTransactionClient(db);

  const owned = ownedClients.get(db);
  if (owned?.pool) {
    const pool = owned.pool;
    const parent = transactionScope.getStore();
    const run = async (connection: PoolClient, client: Database) =>
      (client as NodePgDatabase<typeof restSchema>).transaction(async (tx) => {
        const transaction: Database = tx;
        ownedClients.set(transaction, owned);
        const scope: TransactionScope = {
          pool,
          connection,
          transaction,
          active: true,
          pending: Promise.resolve(),
        };
        try {
          return await transactionScope.run(scope, () => fn(transaction));
        } finally {
          scope.active = false;
        }
      });
    if (parent?.active && parent.pool === pool) {
      // Siblings must not interleave savepoint release/rollback on one lease.
      // A child gets its own scope, allowing its own nested work without waiting
      // on the parent's queue that is currently executing that child.
      const result = parent.pending.then(() => {
        if (!parent.active) throw new Error('Database transaction scope has ended');
        return run(parent.connection, parent.transaction);
      });
      parent.pending = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    }
    const connection = await pool.connect();
    try {
      const client = drizzlePg({
        client: connection,
        schema: restSchema,
        logger: owned.config.logger ?? false,
      });
      return await run(connection, client);
    } finally {
      connection.release();
    }
  }

  // Fallback: Check if this is a pg Pool-based client (supports transactions)
  const hasPgTransaction = 'transaction' in db && typeof db.transaction === 'function';

  if (!hasPgTransaction) {
    throw new Error(
      'Transaction not supported: the injected database client has no callback transaction API. ' +
        'Use a client from the maintained database factory or inject a transaction-capable client.',
    );
  }

  // Use Drizzle's built-in transaction API
  // This automatically handles BEGIN/COMMIT/ROLLBACK
  return (db as NodePgDatabase<typeof restSchema>).transaction((tx) => fn(tx));
}

// =============================================================================
// Saga Helper (NeonDB-safe alternative to withTransaction)
// =============================================================================

/**
 * Execute a saga  -  a NeonDB-safe alternative to withTransaction.
 *
 * withSaga models multi-step writes as individually atomic operations with
 * compensating actions for rollback. withTransaction resolves the maintained
 * callback transport when a single database transaction is required.
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
