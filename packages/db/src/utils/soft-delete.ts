/**
 * Soft-delete query helpers for Drizzle ORM.
 *
 * Tables with a `deletedAt` column use soft-delete: rows are never removed,
 * only marked with a timestamp. These helpers ensure queries consistently
 * filter out soft-deleted rows, preventing accidental data leaks.
 *
 * Usage:
 * ```typescript
 * import { whereActive, withActiveFilter } from '@revealui/db/utils/soft-delete'
 * import { users } from '@revealui/db/schema'
 *
 * // Simple: only active users
 * const active = await db.select().from(users).where(whereActive(users))
 *
 * // Combined with other filters
 * const admins = await db.select().from(users).where(
 *   withActiveFilter(users, eq(users.role, 'admin'))
 * )
 * ```
 */

import type { Column } from 'drizzle-orm';
import { and, isNull, type SQL } from 'drizzle-orm';

/** Any table that has a deletedAt column */
interface SoftDeletable {
  deletedAt: Column;
}

/**
 * Returns a SQL condition that filters to only non-deleted rows.
 *
 * @param table - A Drizzle table with a `deletedAt` column
 * @returns SQL condition: `deleted_at IS NULL`
 */
export function whereActive<T extends SoftDeletable>(table: T): SQL {
  return isNull(table.deletedAt);
}

/**
 * Combines an existing WHERE clause with the soft-delete active filter.
 * If no existing clause is provided, returns just the active filter.
 *
 * @param table - A Drizzle table with a `deletedAt` column
 * @param existingWhere - Optional existing WHERE condition to combine with
 * @returns Combined SQL condition: `(existingWhere) AND deleted_at IS NULL`
 */
export function withActiveFilter<T extends SoftDeletable>(table: T, existingWhere?: SQL): SQL {
  const activeFilter = isNull(table.deletedAt);
  // biome-ignore lint/style/noNonNullAssertion: and() with two defined args always returns SQL
  return existingWhere ? and(existingWhere, activeFilter)! : activeFilter;
}
