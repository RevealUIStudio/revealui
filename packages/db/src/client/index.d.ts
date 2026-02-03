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
import { type PoolMetrics } from '@revealui/core/monitoring'
import { type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { type NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../schema/index.js'
import * as restSchema from '../schema/rest.js'
import * as vectorSchema from '../schema/vector.js'
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
export declare function createClient(
  config: DatabaseConfig,
  dbSchema?: typeof restSchema | typeof vectorSchema | typeof schema,
): Database
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
export declare function getClient(typeOrConnectionString?: DatabaseType | string): Database
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
export declare function getRestClient(): Database
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
export declare function getVectorClient(): Database
/**
 * Resets the global clients (useful for testing).
 * Clears both REST and Vector client instances.
 */
export declare function resetClient(): void
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
export declare function getPoolMetrics(): PoolMetrics[]
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
export declare function closeAllPools(): Promise<void>
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
export declare function withTransaction<T>(
  db: Database,
  fn: (tx: Database) => Promise<T>,
): Promise<T>
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
} from '../schema/index.js'
export type {
  Database as DatabaseSchema,
  DatabaseClient,
  QueryResult,
  QueryResults,
  RelatedTables,
  TableRelationships,
  Transaction,
} from './types.js'
//# sourceMappingURL=index.d.ts.map
