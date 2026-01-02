/**
 * @revealui/db - Database Client
 * 
 * Provides a configured Drizzle ORM client for Neon Postgres.
 * Supports serverless environments (Edge Functions, Vercel, etc.)
 */

import { neon } from '@neondatabase/serverless'
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from '../schema'

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
 * @example
 * ```typescript
 * import { createClient } from '@revealui/db/client'
 * 
 * const db = createClient({
 *   connectionString: process.env.DATABASE_URL!,
 * })
 * 
 * // Query users
 * const users = await db.query.users.findMany()
 * ```
 */
export function createClient(config: DatabaseConfig): Database {
  const sql = neon(config.connectionString)
  
  return drizzle(sql, {
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
 * Uses DATABASE_URL environment variable if no connection string provided.
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
  
  const url = connectionString ?? process.env.DATABASE_URL
  
  if (!url) {
    throw new Error(
      'Database connection string not provided. ' +
      'Either pass connectionString to getClient() or set DATABASE_URL environment variable.'
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
  fn: (tx: Database) => Promise<T>
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
  User, NewUser, Session, NewSession,
  Site, NewSite, SiteCollaborator, NewSiteCollaborator,
  Page, NewPage, PageRevision, NewPageRevision,
  AgentContext, NewAgentContext, AgentMemory, NewAgentMemory,
  Conversation, NewConversation, AgentAction, NewAgentAction,
} from '../schema'
