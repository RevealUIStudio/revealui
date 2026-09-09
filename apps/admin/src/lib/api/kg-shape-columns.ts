/**
 * Electric `columns=` allowlists for fleet knowledge-graph shapes.
 *
 * Electric rejects generated columns unless generated-column replication is
 * supported. `kg_nodes.search` and `kg_edges.search` are GENERATED ALWAYS AS
 * STORED tsvector columns (migrations `0021_knowledge_graph.sql` and
 * `0022_kg_search_text.sql`). Hosted Electric returns HTTP 400
 * `errors.columns` if they are included — which happens when the proxy sets
 * `table` only and syncs every column.
 *
 * Durable fix: request an explicit comma-separated `columns=` list (Electric
 * shapes guide). Do not depend on PG18 `publish_generated_columns`.
 *
 * `embedding` is also omitted: class 3 / never synced P2P, `vector(768)`,
 * unused by the admin canvas or list. Client list search is substring on
 * `name` + `natural_key`; server FTS reads `search` in-DB.
 *
 * Column names match the real tables in `packages/db/src/schema/knowledge-graph.ts`
 * plus the custom SQL migrations. Primary keys must be included.
 *
 * Canvas 400s currently lose to the loading state when both `isLoading` and
 * `error` are set — prefer error over loading is #2842.
 */

/** Generated tsvector + class-3 vector — never include in Electric shapes. */
export const KG_SHAPE_NEVER_SYNC_COLUMNS = ['search', 'embedding'] as const;

/**
 * Sync-safe `kg_nodes` columns. Omits generated `search` and `embedding`.
 * Includes every other real table column the canvas / list / detail pane read
 * (`id`, identity, timestamps, attributes) plus `search_text` (plain text,
 * write-time FTS source; not generated).
 */
export const KG_NODE_SHAPE_COLUMNS = [
  'id',
  'kind',
  'name',
  'natural_key',
  'repo',
  'summary',
  'search_text',
  'attributes',
  'attributes_clock',
  'first_seen_at',
  'last_confirmed_at',
  'deleted_at',
  'created_at',
] as const;

/**
 * Sync-safe `kg_edges` columns. Omits generated `search` and `embedding`.
 * Includes PK + endpoints + fact + bi-temporal columns the canvas uses.
 */
export const KG_EDGE_SHAPE_COLUMNS = [
  'id',
  'source_id',
  'target_id',
  'relation',
  'fact',
  'repo',
  'attributes',
  'valid_at',
  'invalid_at',
  'created_at',
  'expired_at',
] as const;

/**
 * Set Electric's `columns` query param (comma-separated, docs format).
 * Overwrites any client-supplied value so `search` cannot be reintroduced.
 */
export function setElectricShapeColumns(url: URL, columns: readonly string[]): void {
  url.searchParams.set('columns', columns.join(','));
}
