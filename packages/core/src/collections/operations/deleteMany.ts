/**
 * deleteMany Operation
 *
 * Deletes multiple documents in a single transaction. All-or-nothing: if any
 * delete fails (including access denial), the entire batch is rolled back.
 *
 * Documents without a db adapter fall back to in-memory stubs (no transaction).
 */

import type {
  BatchDeleteOptions,
  BatchResult,
  QueryableDatabaseAdapter,
  RevealCollectionConfig,
  RevealDocument,
} from '../../types/index.js';
import { deleteDocument } from './delete.js';

export async function deleteMany(
  config: RevealCollectionConfig,
  db: QueryableDatabaseAdapter | null,
  options: BatchDeleteOptions,
): Promise<BatchResult<RevealDocument>> {
  const results: RevealDocument[] = [];
  const errors: BatchResult<RevealDocument>['errors'] = [];

  if (!db?.query || options.ids.length === 0) {
    // No DB or empty batch: run each delete independently (no transaction available).
    for (const [i, id] of options.ids.entries()) {
      try {
        const doc = await deleteDocument(config, db, {
          id,
          req: options.req,
          overrideAccess: options.overrideAccess,
        });
        results.push(doc);
      } catch (error) {
        errors.push({ index: i, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { results, errors };
  }

  // Wrap all deletes in a transaction: stop on first error, rollback on failure.
  await db.query('BEGIN');
  try {
    for (const id of options.ids) {
      const doc = await deleteDocument(config, db, {
        id,
        req: options.req,
        overrideAccess: options.overrideAccess,
      });
      results.push(doc);
    }
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    const index = results.length; // Index of the failing item
    errors.push({ index, error: error instanceof Error ? error.message : String(error) });
    return { results: [], errors };
  }

  return { results, errors };
}
