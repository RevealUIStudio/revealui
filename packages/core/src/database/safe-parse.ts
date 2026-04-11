/**
 * Safe row parsing for database results.
 *
 * Database drivers return untyped rows  -  this module provides a type guard
 * that filters out malformed rows (missing `id`) before they reach the application.
 * All RevealUI tables have `id` as a non-nullable primary key, so filtering these
 * out prevents crashes from unexpected driver behavior or schema migrations.
 */

import { defaultLogger } from '../instance/logger.js';
import type { RevealDocument } from '../types/index.js';

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
    defaultLogger.warn('Database row is not an object  -  skipping', { row });
    return null;
  }

  const r = row as Record<string, unknown>;

  if (typeof r.id !== 'string' && typeof r.id !== 'number') {
    defaultLogger.warn('Database row missing required id field  -  skipping', {
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
