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
} from "../../types/index.js";

export async function deleteDocument(
	config: RevealCollectionConfig,
	db: {
		query: (query: string, values?: unknown[]) => Promise<DatabaseResult>;
	} | null,
	options: RevealDeleteOptions,
): Promise<RevealDocument> {
	const { id } = options;

	if (db?.query) {
		const tableName = config.slug;
		// Ensure id is a string for consistent comparison
		const idString = String(id);
		const query = `DELETE FROM "${tableName}" WHERE id = $1`;
		await db.query(query, [idString]);
	}

	return { id };
}
