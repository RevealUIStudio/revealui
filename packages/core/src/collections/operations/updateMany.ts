/**
 * updateMany Operation
 *
 * Updates multiple documents in a single transaction. All-or-nothing: if any
 * update fails, the entire batch is rolled back.
 *
 * Documents without a db adapter fall back to in-memory objects (no transaction).
 */

import type {
  BatchResult,
  BatchUpdateOptions,
  QueryableDatabaseAdapter,
  RevealCollectionConfig,
  RevealDocument,
} from '../../types/index.js';
import { update } from './update.js';

export async function updateMany(
  config: RevealCollectionConfig,
  db: QueryableDatabaseAdapter | null,
  options: BatchUpdateOptions,
): Promise<BatchResult<RevealDocument>> {
  const results: RevealDocument[] = [];
  const errors: BatchResult<RevealDocument>['errors'] = [];

  if (!db?.query || options.updates.length === 0) {
    // No DB or empty batch: run each update independently (no transaction available).
    for (const [i, item] of options.updates.entries()) {
      try {
        const doc = await update(config, db, {
          id: item.id,
          data: item.data,
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

  // Wrap all updates in a transaction: stop on first error, rollback on failure.
  await db.query('BEGIN');
  try {
    for (const item of options.updates) {
      const doc = await update(config, db, {
        id: item.id,
        data: item.data,
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
