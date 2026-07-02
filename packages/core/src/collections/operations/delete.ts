/**
 * Delete Operation
 *
 * Deletes a document by ID with access control enforcement.
 */

import type {
  QueryableDatabaseAdapter,
  RevealCollectionConfig,
  RevealDeleteOptions,
  RevealDocument,
  RevealRequest,
  RevealWhere,
} from '../../types/index.js';
import { find } from './find.js';
import { deleteByIdQuery } from './sqlAdapter.js';

/**
 * Evaluate a collection's access.delete function.
 * Returns true (allow) or false (deny).
 */
async function evaluateDeleteAccess(
  config: RevealCollectionConfig,
  options: RevealDeleteOptions,
): Promise<true | false | RevealWhere> {
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
  if (result === true) return true;

  // A WhereClause = row-level access: allowed only for rows matching the filter.
  return result as RevealWhere;
}

export async function deleteDocument(
  config: RevealCollectionConfig,
  db: QueryableDatabaseAdapter | null,
  options: RevealDeleteOptions,
): Promise<RevealDocument> {
  const { id } = options;

  // --- Access control enforcement ---
  const access = await evaluateDeleteAccess(config, options);
  if (access === false) {
    throw new Error('Access denied: insufficient permissions to delete this document');
  }
  if (access !== true) {
    // Row-level access: confirm the target row matches the ownership filter
    // before deleting, so delete() cannot remove a row outside the caller's
    // scope. Reuse find()'s AND-merge; overrideAccess skips re-evaluation.
    const scoped = await find(config, db, {
      where: { and: [{ id: { equals: id } }, access] },
      limit: 1,
      req: options.req,
      overrideAccess: true,
    });
    if (scoped.docs.length === 0) {
      throw new Error('Access denied: insufficient permissions to delete this document');
    }
  }

  // Typed-storage write seam: a registered collectionStorage adapter may own
  // this collection's deletes (e.g. soft-delete semantics on a typed table). It
  // returns the deleted document, throws for not-found, or returns `undefined`
  // to defer to the dynamic-SQL path below (same not-handled contract as the
  // read seam).
  if (db?.collectionStorage?.delete) {
    const result = await db.collectionStorage.delete(config, {
      id,
      ...(options.req ? { req: options.req } : {}),
    });
    if (result !== undefined) {
      return result;
    }
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
