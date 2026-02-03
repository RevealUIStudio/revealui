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

import { neon } from '@neondatabase/serverless'
// Import config module (ESM)
// Config uses proxy for lazy loading, so import is safe - validation only happens on property access
// Direct ESM import - the Proxy ensures no validation occurs until properties are accessed
import configModule from '@revealui/config'
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../schema/index.js' // Full schema for backward compatibility
import * as restSchema from '../schema/rest.js'
import * as vectorSchema from '../schema/vector.js'

// Dynamic import to break circular dependency (db <-> core)
// This avoids static dependency at build time
let monitoringModule: typeof import('@revealui/core/monitoring') | null = null
async function getMonitoring() {
  if (!monitoringModule) {
    try {
      monitoringModule = await import('@revealui/core/monitoring')
    } catch {
      // Monitoring module not available (e.g., during build)
      monitoringModule = null
    }
  }
  return monitoringModule
}

// Define PoolMetrics type locally to avoid circular dependency
// This matches the type from @revealui/core/monitoring
export interface PoolMetrics {
  /** Total connections in pool */
  totalCount: number
  /** Idle connections */
  idleCount: number
  /** Waiting requests */
  waitingCount: number
  /** Pool name/identifier */
  name: string
}

// =============================================================================
// Types
// =============================================================================

/**
 * Database type selector for dual database architecture
 * - 'rest': NeonDB for transactional REST API operations
 * - 'vector': Supabase for vector search operations
 */
export type DatabaseType = 'rest' | 'vector'

/**
 * Database client type (Drizzle ORM client)
 *
 * This is the actual database client returned by createClient/getClient.
 * For the centralized Database type matching Supabase structure, see @revealui/db/types
 *
 * Note: This is a union type to support both Neon (REST) and Postgres (Vector) drivers.
 * The actual type will be NeonHttpDatabase for REST and PgDatabase for Vector.
 */
export type Database = NeonHttpDatabase<typeof schema> | NodePgDatabase<typeof schema>

export interface DatabaseConfig {
  connectionString: string
  logger?: boolean
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
 * Detects if a connection string is for Supabase.
 * Supabase connection strings contain '.supabase.co' or 'pooler.supabase.com'.
 */
function isSupabaseConnection(connectionString: string): boolean {
  return (
    connectionString.includes('.supabase.co') || connectionString.includes('pooler.supabase.com')
  )
}

/**
 * Creates a Drizzle database client, automatically selecting the appropriate driver:
 * - Supabase connections: Uses postgres-js with drizzle-orm/postgres-js
 * - NeonDB connections: Uses @neondatabase/serverless with drizzle-orm/neon-http
 *
 * This dual-driver approach fixes the Neon driver's compatibility issue with Supabase,
 * where it incorrectly transforms Supabase hostnames.
 *
 * @param config - Database configuration
 * @param dbSchema - Optional schema to use (defaults to full schema for backward compatibility)
 *
 * @example
 * ```typescript
 * import { createClient } from '@revealui/db/client'
 *
 * // Automatically uses postgres-js for Supabase
 * const supabaseDb = createClient({
 *   connectionString: process.env.DATABASE_URL!, // Supabase URL
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
  const isSupabase = isSupabaseConnection(config.connectionString)

  if (isSupabase) {
    // Use pg for Supabase connections
    // This avoids the Neon driver's hostname transformation bug
    const pool = new Pool({
      connectionString: config.connectionString,
      ssl: { rejectUnauthorized: false }, // Supabase requires SSL
      max: 10, // Connection limit
      idleTimeoutMillis: 30_000, // 30 seconds
      connectionTimeoutMillis: 10_000, // 10 seconds
    })

    // Track pool and register cleanup
    const poolId = `pool-${activePools.size + 1}`
    activePools.set(poolId, pool)
    // Register cleanup handler asynchronously (non-blocking)
    registerPoolCleanup().catch(() => {
      // Silently ignore if monitoring module is not available
    })

    return drizzlePg({
      client: pool,
      schema: dbSchema,
      logger: config.logger ?? false,
    }) as Database
  } else {
    // Use Neon serverless driver for NeonDB connections
    const sql = neon(config.connectionString)

    return drizzleNeon({
      client: sql,
      schema: dbSchema,
      logger: config.logger ?? false,
    }) as Database
  }
}

// =============================================================================
// Global Client (for singleton usage)
// =============================================================================

let restClient: Database | null = null
let vectorClient: Database | null = null

// Track all pg.Pool instances for monitoring and cleanup
const activePools: Map<string, Pool> = new Map()

// Register cleanup handler
let cleanupHandlerRegistered = false
async function registerPoolCleanup() {
  if (cleanupHandlerRegistered) return

  const monitoring = await getMonitoring()
  if (monitoring?.registerCleanupHandler) {
    monitoring.registerCleanupHandler(
      'database-pools',
      async () => {
        await closeAllPools()
      },
      'Close all database connection pools',
      100, // High priority
    )
  }

  cleanupHandlerRegistered = true
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
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export function getClient(typeOrConnectionString?: DatabaseType | string): Database {
  // Legacy API: If first argument is a string and not 'rest' or 'vector', treat as connection string
  if (typeOrConnectionString && typeof typeOrConnectionString === 'string') {
    if (typeOrConnectionString === 'rest' || typeOrConnectionString === 'vector') {
      // New API: Type specified
      const type = typeOrConnectionString as DatabaseType
      return getClientByType(type)
    } else if (
      typeOrConnectionString.startsWith('postgresql://') ||
      typeOrConnectionString.startsWith('postgres://')
    ) {
      // Legacy API: Connection string provided, use as REST client
      if (!restClient) {
        restClient = createClient({ connectionString: typeOrConnectionString })
      }
      return restClient
    }
  }

  // Default to 'rest' for backward compatibility
  return getClientByType('rest')
}

/**
 * Internal function to get client by type
 */
function getClientByType(type: DatabaseType): Database {
  if (type === 'vector') {
    if (!vectorClient) {
      const url = process.env.DATABASE_URL
      if (!url || typeof url !== 'string') {
        throw new Error(
          'DATABASE_URL environment variable is required for vector database. ' +
            'Set DATABASE_URL to your Supabase connection string.',
        )
      }
      vectorClient = createClient({ connectionString: url }, vectorSchema)
    }
    return vectorClient
  }

  // type === 'rest'
  if (!restClient) {
    // Try to get from config module (ESM - lazy validation via Proxy)
    let url: string | undefined
    try {
      const configUrl = configModule.database?.url
      if (typeof configUrl === 'string') {
        url = configUrl
      }
    } catch {
      // Config validation failed or module unavailable - will use process.env fallback
      url = undefined
    }

    // Fallback to process.env
    url = url ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL

    if (!url || typeof url !== 'string') {
      throw new Error(
        'Database connection string not provided for REST database. ' +
          'Either use @revealui/config, or set POSTGRES_URL (or DATABASE_URL) environment variable.',
      )
    }

    restClient = createClient({ connectionString: url }, restSchema)
  }
  return restClient
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
  return getClient('rest')
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
  return getClient('vector')
}

/**
 * Resets the global clients (useful for testing).
 * Clears both REST and Vector client instances.
 */
export function resetClient(): void {
  restClient = null
  vectorClient = null
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
 *   console.log(`${pool.name}: ${pool.totalCount} total, ${pool.idleCount} idle`)
 * }
 * ```
 */
export function getPoolMetrics(): PoolMetrics[] {
  const metrics: PoolMetrics[] = []

  for (const [name, pool] of activePools) {
    metrics.push({
      name,
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    })
  }

  return metrics
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
  const closePromises: Promise<void>[] = []

  for (const [_name, pool] of activePools) {
    closePromises.push(
      pool.end().catch((_error) => {
        // Silently handle pool close errors during shutdown
        // Pool is being removed from activePools regardless
      }),
    )
  }

  await Promise.all(closePromises)
  activePools.clear()

  // Reset global clients
  restClient = null
  vectorClient = null
}

// =============================================================================
// Transaction Helper
// =============================================================================

/**
 * Executes a function within a database transaction.
 *
 * Note: Neon HTTP driver doesn't support true transactions,
 * but this provides a consistent API for future migration to
 * a connection-based driver.
 *
 * @example
 * ```typescript
 * import { getClient, withTransaction } from '@revealui/db/client'
 *
 * const result = await withTransaction(getClient(), async (tx) => {
 *   const site = await tx.insert(sites).values({ ... }).returning()
 *   await tx.insert(pages).values({ siteId: site.id, ... })
 *   return site
 * })
 * ```
 */
export async function withTransaction<T>(
  db: Database,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  // Note: Neon HTTP doesn't support true transactions
  // This is a placeholder for API consistency
  // For real transactions, use @neondatabase/serverless pooled connection
  return fn(db)
}

// =============================================================================
// Re-exports
// =============================================================================

export { schema }
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
} from '../schema/index.js'
// Re-export type utilities
export type {
  Database as DatabaseSchema,
  DatabaseClient,
  QueryResult,
  QueryResults,
  RelatedTables,
  TableRelationships,
  Transaction,
} from './types.js'
