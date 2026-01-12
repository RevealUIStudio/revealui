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
import * as schema from '../core'

// =============================================================================
// Types
// =============================================================================

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
export function createClient(config: DatabaseConfig): Database {
  // Use the official Drizzle pattern for neon-http
  // Pattern: drizzle({ client: neon(connectionString) })
  // Reference: https://orm.drizzle.team/docs/connect-neon
  const sql = neon(config.connectionString)

  return drizzle({
    client: sql,
    schema,
    logger: config.logger ?? false,
  })
}

// =============================================================================
// Global Client (for singleton usage)
// =============================================================================

let globalClient: Database | null = null

/**
 * Gets or creates a global database client.
 * Uses config module if available, otherwise falls back to process.env for backward compatibility.
 *
 * @example
 * ```typescript
 * import { getClient } from '@revealui/db/client'
 *
 * const db = getClient()
 * const users = await db.query.users.findMany()
 * ```
 */
export function getClient(connectionString?: string): Database {
  if (globalClient) {
    return globalClient
  }

  // Use provided connection string, or try config module, or fallback to process.env
  let url = connectionString

  if (!url) {
    // Try to get from config module (ESM - lazy validation via Proxy)
    // Accessing config.database.url triggers lazy validation via proxy
    try {
      url = configModule.database?.url
    } catch {
      // Config validation failed or module unavailable - will use process.env fallback
      url = undefined
    }
  }

  // Fallback to process.env
  url = url ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL

  if (!url) {
    throw new Error(
      'Database connection string not provided. ' +
        'Either pass connectionString to getClient(), use @revealui/config, or set POSTGRES_URL (or DATABASE_URL) environment variable.',
    )
  }

  globalClient = createClient({ connectionString: url })
  return globalClient
}

/**
 * Resets the global client (useful for testing).
 */
export function resetClient(): void {
  globalClient = null
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
