/**
 * Safe row parsing for database results.
 *
 * Validate generic SQL result shapes at the driver boundary. Document-specific
 * parsing is separate because aggregates and projections need not select an ID.
 */

import { z } from 'zod';
import { logger } from '../observability/logger.js';
import type { RevealDocument } from '../types/index.js';

/**
 * Validate the raw SQL row boundary without imposing a document projection.
 * Column values are unknown because PostgreSQL expressions/custom type parsers
 * can return arbitrary values; query consumers own their semantic validation.
 * Reject malformed results atomically instead of silently dropping rows.
 */
const databaseRowSchema = z
  .unknown()
  .refine(
    (row) => row === null || typeof row !== 'object' || !Object.hasOwn(row, '__proto__'),
    'Database row contains a reserved prototype key',
  )
  .pipe(z.record(z.string(), z.unknown()));
const databaseRowsSchema = z.array(databaseRowSchema);

export function parseDatabaseRows(rows: unknown): Record<string, unknown>[] {
  return databaseRowsSchema.parse(rows);
}

/**
 * Validate that a raw database row is a valid RevealDocument.
 *
 * Checks only the structural requirement: the row must be a non-null object
 * with an `id` field of type string or number. All other fields are passed
 * through as-is (trusting the database schema).
 *
 * @param row - Raw value from database driver (unknown type)
 * @returns The row typed as RevealDocument, or null if malformed
 */
export function safeParseRevealDocument(row: unknown): RevealDocument | null {
  if (row === null || typeof row !== 'object') {
    logger.warn('Database row is not an object  -  skipping', { row });
    return null;
  }

  const r = row as Record<string, unknown>;

  if (typeof r.id !== 'string' && typeof r.id !== 'number') {
    logger.warn('Database row missing required id field  -  skipping', {
      keys: Object.keys(r),
    });
    return null;
  }

  return r as unknown as RevealDocument;
}

/**
 * Parse an array of raw database rows into RevealDocument[], filtering out
 * any malformed rows and logging warnings for each one skipped.
 */
export function safeParseRevealDocuments(rows: unknown[]): RevealDocument[] {
  return rows
    .map((row) => safeParseRevealDocument(row))
    .filter((doc): doc is RevealDocument => doc !== null);
}
