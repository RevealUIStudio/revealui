/**
 * Database Client Type Utilities
 *
 * Provides type utilities for working with the database client,
 * including query builder types, transaction types, and other utilities.
 *
 * @module @revealui/db/client/types
 */

import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type * as schema from '../schema/index.js';
import type { Database } from '../types/index.js';

/**
 * Re-export the centralized Database type for convenience
 */
export type { Database };

/**
 * Database client type (Drizzle ORM client)
 *
 * This is the actual database client returned by createClient/getClient.
 */
export type DatabaseClient = NeonHttpDatabase<typeof schema>;

/**
 * Extract query result type for a table
 *
 * @template T - The Database type
 * @template N - The table name
 */
export type QueryResult<
  T extends Database,
  N extends keyof T['public']['Tables'],
> = T['public']['Tables'][N] extends {
  Row: infer R;
}
  ? R
  : never;

/**
 * Extract query results type for multiple tables
 *
 * @template T - The Database type
 * @template N - Array of table names
 */
export type QueryResults<T extends Database, N extends Array<keyof T['public']['Tables']>> = {
  [K in N[number]]: T['public']['Tables'][K] extends {
    Row: infer R;
  }
    ? R
    : never;
};

/**
 * Transaction type for database operations
 *
 * Note: Neon HTTP driver doesn't support true transactions,
 * but this type provides API consistency for future migration.
 */
export type Transaction = DatabaseClient;

/**
 * Type-safe query utilities
 *
 * Note: Drizzle ORM already provides excellent type safety through its native API.
 * Use Drizzle's native API directly for type-safe queries - no wrapper interface needed.
 *
 * @example
 * ```typescript
 * import { getClient } from '@revealui/db/client'
 * import { users } from '@revealui/db/schema'
 * import { eq } from 'drizzle-orm'
 * import type { Database } from '@revealui/db/types'
 *
 * const db = getClient()
 *
 * // Drizzle provides full type safety
 * const allUsers = await db.query.users.findMany()
 * const user = await db.query.users.findFirst({
 *   where: eq(users.id, 'user-123')
 * })
 *
 * // Type-safe inserts
 * const newUser: Database['public']['Tables']['users']['Insert'] = {
 *   id: 'user-123',
 *   email: 'user@example.com',
 *   name: 'User',
 *   schemaVersion: '1',
 *   type: 'human',
 * }
 * await db.insert(users).values(newUser)
 *
 * // Type-safe updates
 * await db.update(users)
 *   .set({ name: 'Updated Name' })
 *   .where(eq(users.id, 'user-123'))
 * ```
 *
 * Drizzle's native API is fully type-safe and provides all the functionality
 * you need. No wrapper interface is necessary.
 */

/**
 * Extract table relationships for a specific table
 *
 * @template T - The Database type
 * @template N - The table name
 */
export type TableRelationships<
  T extends Database,
  N extends keyof T['public']['Tables'],
> = T['public']['Tables'][N] extends {
  Relationships: infer R;
}
  ? R
  : never;

/**
 * Helper type to extract all related table names for a table
 *
 * @template T - The Database type
 * @template N - The table name
 */
export type RelatedTables<
  T extends Database,
  N extends keyof T['public']['Tables'],
> = T['public']['Tables'][N] extends {
  Relationships: infer R;
}
  ? R extends ReadonlyArray<{ referencedRelation: infer Rel }>
    ? Rel extends keyof T['public']['Tables']
      ? Rel
      : never
    : never
  : never;
