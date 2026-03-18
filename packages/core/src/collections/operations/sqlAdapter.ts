import type { DatabaseResult } from '../../types/index.js';

export type QueryableCollectionDb = {
  query: (query: string, values?: unknown[]) => Promise<DatabaseResult>;
};

/**
 * Dynamic collections resolve table and column names at runtime from config.
 * Drizzle is the default elsewhere in the codebase. This adapter exists only
 * because these collection operations target runtime-selected tables/columns
 * that do not map cleanly to Drizzle's compile-time table model yet.
 *
 * Treat this as a temporary quarantine boundary for dynamic SQL. Do not add
 * inline SQL back into the collection operations; extend this adapter or
 * redesign the collection storage layer toward typed tables instead.
 */

/** Only lowercase alphanumeric, hyphens, and underscores (1-63 chars, PostgreSQL identifier limit). */
const VALID_SLUG = /^[a-z][a-z0-9_-]{0,62}$/;

export function validateSlug(slug: string): void {
  if (!VALID_SLUG.test(slug)) {
    throw new Error(
      `Invalid collection slug: "${slug}". Slugs must start with a lowercase letter and contain only lowercase alphanumeric characters, hyphens, and underscores (max 63 chars).`,
    );
  }
}

/** Only lowercase alphanumeric and underscores (PostgreSQL column name safe). */
const VALID_COLUMN = /^[a-z_][a-z0-9_]{0,62}$/;

export function validateColumnName(column: string): void {
  if (!VALID_COLUMN.test(column)) {
    throw new Error(
      `Invalid column name: "${column}". Column names must start with a lowercase letter or underscore and contain only lowercase alphanumeric characters and underscores.`,
    );
  }
}

export function escapeIdentifier(identifier: string): string {
  return identifier.replace(/"/g, '""');
}

export function collectionTable(configSlug: string): string {
  validateSlug(configSlug);
  return `"${escapeIdentifier(configSlug)}"`;
}

export function selectByIdQuery(configSlug: string): string {
  return `SELECT * FROM ${collectionTable(configSlug)} WHERE id = $1 LIMIT 1`;
}

export function deleteByIdQuery(configSlug: string): string {
  return `DELETE FROM ${collectionTable(configSlug)} WHERE id = $1`;
}

export function countDocumentsQuery(configSlug: string, whereClause?: string): string {
  return whereClause
    ? `SELECT COUNT(*) as total FROM ${collectionTable(configSlug)} WHERE ${whereClause}`
    : `SELECT COUNT(*) as total FROM ${collectionTable(configSlug)}`;
}

export function listDocumentsQuery(
  configSlug: string,
  whereClause: string,
  orderByClause: string,
  limitParam: number,
  offsetParam: number,
): string {
  return `SELECT * FROM ${collectionTable(configSlug)} ${whereClause ? `WHERE ${whereClause}` : ''} ${orderByClause} LIMIT $${limitParam} OFFSET $${offsetParam}`;
}

export function insertDocumentQuery(configSlug: string, columns: string[]): string {
  for (const col of columns) validateColumnName(col);
  const escapedColumns = columns.map((column) => `"${escapeIdentifier(column)}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ');
  return `INSERT INTO ${collectionTable(configSlug)} (id, ${escapedColumns}) VALUES ($1, ${placeholders})`;
}

export function selectJsonByIdQuery(configSlug: string): string {
  return `SELECT _json FROM ${collectionTable(configSlug)} WHERE id = $1 LIMIT 1`;
}

export function checkExistsByIdQuery(configSlug: string): string {
  return `SELECT id FROM ${collectionTable(configSlug)} WHERE id = $1 LIMIT 1`;
}

export function updateByIdQuery(configSlug: string, keys: string[]): string {
  for (const key of keys) validateColumnName(key);
  const setClause = keys.map((key, i) => `"${escapeIdentifier(key)}" = $${i + 1}`).join(', ');
  return `UPDATE ${collectionTable(configSlug)} SET ${setClause} WHERE id = $${keys.length + 1}`;
}

/**
 * Version-aware UPDATE: includes `version = version + 1` in SET
 * and `AND version = $N` in WHERE for optimistic locking.
 * Returns the number of affected rows (0 = conflict).
 */
export function updateByIdWithVersionQuery(configSlug: string, keys: string[]): string {
  for (const key of keys) validateColumnName(key);
  const setClause = keys.map((key, i) => `"${escapeIdentifier(key)}" = $${i + 1}`).join(', ');
  // version param is at keys.length + 1, id param is at keys.length + 2
  return `UPDATE ${collectionTable(configSlug)} SET ${setClause}, "version" = "version" + 1 WHERE id = $${keys.length + 2} AND "version" = $${keys.length + 1}`;
}
