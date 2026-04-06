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

// Re-export audit stores
export { DrizzleAuditStore } from './audit-store.js';
// Re-export client utilities
export {
  closeAllPools,
  createClient,
  type Database as DatabaseClient,
  type DatabaseConfig,
  type DatabaseType,
  getClient,
  getPoolMetrics,
  getRestClient,
  getVectorClient,
  requiresTransactions,
  resetClient,
  schema,
  withTransaction,
} from './client/index.js';
// Re-export saga module
export type {
  SagaContext,
  SagaOptions,
  SagaResult,
  SagaStep,
} from './saga/index.js';
// Re-export saga module
export {
  executeSaga,
  executeSaga as withSaga,
  idempotentWrite,
  recoverStaleSagas,
  resilientStep,
} from './saga/index.js';
// Re-export everything from core (schema)
export * from './schema/index.js';
// Re-export Database types (centralized type matching Supabase structure)
export type {
  Database,
  TableInsert,
  TableRelationships,
  TableRow,
  TableUpdate,
} from './types/index.js';
// Re-export soft-delete helpers
export { whereActive, withActiveFilter } from './utils/soft-delete.js';
