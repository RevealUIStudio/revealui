/**
 * @revealui/db - Database Client
 *
 * Provides a configured Drizzle ORM client for Neon Postgres.
 * Supports serverless environments (Edge Functions, Vercel, etc.)
 *
 * This setup uses @neondatabase/serverless with drizzle-orm/neon-http,
 * which is PERFECT for Supabase transaction pooling (port 6543) because:
 * - The Neon HTTP driver doesn't use prepared statements (uses HTTP requests)
 * - Works automatically with transaction pooling mode
 * - No need for `prepare: false` option (only needed with postgres-js driver)
 *
 * Connection String Format:
 * - Transaction Pooling: postgresql://...@db.xxx.supabase.co:6543/postgres
 * - Direct Connection: postgresql://...@db.xxx.supabase.co:5432/postgres
 *
 * Reference: https://supabase.com/docs/guides/database/connecting-to-postgres#connecting-with-drizzle
 */

import { neon } from '@neondatabase/serverless'
// Import config module (ESM)
// Config uses proxy for lazy loading, so import is safe - validation only happens on property access
// Direct ESM import - the Proxy ensures no validation occurs until properties are accessed
import configModule from '@revealui/config'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as restSchema from '../core/rest'
import * as vectorSchema from '../core/vector'
import * as schema from '../core' // Full schema for backward compatibility

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
 */
export type Database = NeonHttpDatabase<typeof schema>

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
export function createClient(
  config: DatabaseConfig,
  dbSchema: typeof restSchema | typeof vectorSchema | typeof schema = schema,
): Database {
  // Use the official Drizzle pattern for neon-http
  // Pattern: drizzle({ client: neon(connectionString) })
  // Reference: https://orm.drizzle.team/docs/connect-neon
  const sql = neon(config.connectionString)

  return drizzle({
    client: sql,
    schema: dbSchema,
    logger: config.logger ?? false,
  })
}

// =============================================================================
// Global Client (for singleton usage)
// =============================================================================

let restClient: Database | null = null
let vectorClient: Database | null = null

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
export function getClient(typeOrConnectionString?: DatabaseType | string): Database {
  // Legacy API: If first argument is a string and not 'rest' or 'vector', treat as connection string
  if (typeOrConnectionString && typeof typeOrConnectionString === 'string') {
    if (typeOrConnectionString === 'rest' || typeOrConnectionString === 'vector') {
      // New API: Type specified
      const type = typeOrConnectionString as DatabaseType
      return getClientByType(type)
    } else if (typeOrConnectionString.startsWith('postgresql://') || typeOrConnectionString.startsWith('postgres://')) {
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
} from '../core'
// Re-export type utilities
export type {
  Database as DatabaseType,
  DatabaseClient,
  QueryResult,
  QueryResults,
  RelatedTables,
  TableRelationships,
  Transaction,
} from './types'
