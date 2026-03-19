/**
 * createMany Operation
 *
 * Creates multiple documents in a single transaction. All-or-nothing: if any
 * document fails, the entire batch is rolled back. Partial results are never
 * committed to the database.
 *
 * Documents without a db adapter fall back to in-memory objects (no transaction).
 */

import type {
  BatchCreateOptions,
  BatchResult,
  QueryableDatabaseAdapter,
  RevealCollectionConfig,
  RevealDocument,
} from '../../types/index.js';
import { create } from './create.js';

export async function createMany(
  config: RevealCollectionConfig,
  db: QueryableDatabaseAdapter | null,
  options: BatchCreateOptions,
): Promise<BatchResult<RevealDocument>> {
  const results: RevealDocument[] = [];
  const errors: BatchResult<RevealDocument>['errors'] = [];

  if (!db?.query || options.data.length === 0) {
    // No DB or empty batch: run each create independently (no transaction available).
    for (const [i, data] of options.data.entries()) {
      try {
        const doc = await create(config, db, { data, req: options.req });
        results.push(doc);
      } catch (error) {
        errors.push({ index: i, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { results, errors };
  }

  // Wrap all inserts in a transaction: stop on first error, rollback on failure.
  await db.query('BEGIN');
  try {
    for (const data of options.data) {
      const doc = await create(config, db, { data, req: options.req });
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
