/**
 * @revealui/db - Database Package
 * 
 * Provides Drizzle ORM schema definitions and database client for RevealUI.
 * Designed for Neon Postgres with pgvector extension.
 * 
 * ## Usage
 * 
 * ### Schema
 * ```typescript
 * import { users, sites, pages } from '@revealui/db/schema'
 * ```
 * 
 * ### Client
 * ```typescript
 * import { getClient } from '@revealui/db/client'
 * const db = getClient()
 * ```
 * 
 * ### Full Package
 * ```typescript
 * import { getClient, users, sites, pages } from '@revealui/db'
 * ```
 */

// Re-export everything from schema
export * from './schema'

// Re-export client utilities
export {
  createClient,
  getClient,
  resetClient,
  withTransaction,
  schema,
  type Database,
  type DatabaseConfig,
} from './client'
