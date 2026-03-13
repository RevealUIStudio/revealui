/**
 * Delete Operation
 *
 * Deletes a document by ID.
 */

import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealDeleteOptions,
  RevealDocument,
} from '../../types/index.js';
import { deleteByIdQuery } from './sqlAdapter.js';

export async function deleteDocument(
  config: RevealCollectionConfig,
  db: {
    query: (query: string, values?: unknown[]) => Promise<DatabaseResult>;
  } | null,
  options: RevealDeleteOptions,
): Promise<RevealDocument> {
  const { id } = options;

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
