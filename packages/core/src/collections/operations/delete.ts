/**
 * Delete Operation
 *
 * Deletes a document by ID with access control enforcement.
 */

import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealDeleteOptions,
  RevealDocument,
  RevealRequest,
} from '../../types/index.js';
import { deleteByIdQuery } from './sqlAdapter.js';

/**
 * Evaluate a collection's access.delete function.
 * Returns true (allow) or false (deny).
 */
async function evaluateDeleteAccess(
  config: RevealCollectionConfig,
  options: RevealDeleteOptions,
): Promise<boolean> {
  if (options.overrideAccess) return true;

  const accessConfig = (
    config as {
      access?: {
        delete?: (args: { req: RevealRequest; id?: string | number }) => unknown;
      };
    }
  ).access;
  const deleteAccess = accessConfig?.delete;

  // No access rule defined = allow all (backward compatible)
  if (!deleteAccess) return true;

  const req = options.req;
  if (!req) return false; // No request context = deny (safe default)

  const result = await deleteAccess({ req, id: options.id });

  if (result === false) return false;

  // Any truthy result (true, WhereClause) = allowed for single-document operations
  return !!result;
}

export async function deleteDocument(
  config: RevealCollectionConfig,
  db: {
    query: (query: string, values?: unknown[]) => Promise<DatabaseResult>;
  } | null,
  options: RevealDeleteOptions,
): Promise<RevealDocument> {
  const { id } = options;

  // --- Access control enforcement ---
  const allowed = await evaluateDeleteAccess(config, options);
  if (!allowed) {
    throw new Error('Access denied: insufficient permissions to delete this document');
  }

  if (db?.query) {
    // Dynamic collection storage is quarantined in sqlAdapter.ts until this
    // layer is redesigned around typed tables that Drizzle can model directly.
    const tableName = config.slug;
    // Ensure id is a string for consistent comparison
    const idString = String(id);
    const query = deleteByIdQuery(tableName);
    await db.query(query, [idString]);
  }

  return { id };
}
