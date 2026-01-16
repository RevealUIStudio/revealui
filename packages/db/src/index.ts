/**
 * @revealui/db - Database Package
 *
 * Provides Drizzle ORM schema definitions and database client for RevealUI.
 * Designed for Neon Postgres with pgvector extension.
 *
 * ## Usage
 *
 * ### Core (Schema)
 * ```typescript
 * import { users, sites, pages } from '@revealui/db/core'
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

// Re-export client utilities
export {
  createClient,
  type Database as DatabaseClient,
  type DatabaseConfig,
  getClient,
  resetClient,
  schema,
  withTransaction,
} from './client'
// Re-export everything from core (schema)
export * from './core'
// Re-export Database types (centralized type matching Supabase structure)
export type { Database, TableInsert, TableRelationships, TableRow, TableUpdate } from './types'
