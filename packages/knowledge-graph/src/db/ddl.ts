/**
 * Knowledge-graph DDL builder — the single source for graph table structure.
 *
 * The production migration (`packages/db/migrations/0021_knowledge_graph.sql`)
 * ships the `vector`-variant DDL (with HNSW indexes) and is validated for drift
 * against this builder by a unit test. Tests build the same tables in PGlite via
 * the `portable` variant (embedding as `real[]`, no HNSW) so FTS, temporal, BFS
 * and RRF behavior is exercised against real Postgres semantics without the
 * pgvector extension. tsvector generated columns, GIN, and partial current-edge
 * indexes are identical across both variants.
 */

export interface KgDdlOptions {
  /**
   * `vector` → pgvector `vector(768)` columns + HNSW indexes (production).
   * `portable` → `real[]` columns, no vector index (PGlite / no-pgvector tests).
   */
  variant: 'vector' | 'portable';
}

/** Every table this package owns, in FK-dependency order. */
export const KG_TABLES = [
  'kg_episodes',
  'kg_nodes',
  'kg_edges',
  'kg_edge_episodes',
  'kg_node_aliases',
  'kg_outbox',
] as const;

export function kgDdlStatements(options: KgDdlOptions): string[] {
  const embedding = options.variant === 'vector' ? 'vector(768)' : 'real[]';
  const statements: string[] = [];

  statements.push(`CREATE TABLE IF NOT EXISTS "kg_episodes" (
  "id"             text PRIMARY KEY,
  "episode_type"   text NOT NULL,
  "source"         text NOT NULL,
  "site_id"        text NOT NULL,
  "content"        text,
  "content_ref"    jsonb DEFAULT '{}'::jsonb,
  "reference_time" timestamptz NOT NULL,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "kg_episodes_type_check" CHECK ("episode_type" IN
    ('code-scan', 'git-commit', 'doc', 'agent-fact', 'memory', 'json', 'manual'))
)`);
  statements.push(
    `CREATE INDEX IF NOT EXISTS "kg_episodes_source_idx" ON "kg_episodes" ("source")`,
  );
  statements.push(
    `CREATE INDEX IF NOT EXISTS "kg_episodes_reference_time_idx" ON "kg_episodes" ("reference_time")`,
  );

  statements.push(`CREATE TABLE IF NOT EXISTS "kg_nodes" (
  "id"                text PRIMARY KEY,
  "kind"              text NOT NULL,
  "name"              text NOT NULL,
  "natural_key"       text NOT NULL,
  "repo"              text,
  "summary"           text,
  "attributes"        jsonb DEFAULT '{}'::jsonb,
  "attributes_clock"  jsonb DEFAULT '{}'::jsonb,
  "embedding"         ${embedding},
  "search"            tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("summary", '')), 'B')
  ) STORED,
  "first_seen_at"     timestamptz NOT NULL,
  "last_confirmed_at" timestamptz NOT NULL,
  "deleted_at"        timestamptz,
  "created_at"        timestamptz NOT NULL DEFAULT now()
)`);
  statements.push(
    `CREATE UNIQUE INDEX IF NOT EXISTS "kg_nodes_natural_key_idx" ON "kg_nodes" ("natural_key")`,
  );
  statements.push(
    `CREATE INDEX IF NOT EXISTS "kg_nodes_kind_natural_key_idx" ON "kg_nodes" ("kind", "natural_key")`,
  );
  statements.push(`CREATE INDEX IF NOT EXISTS "kg_nodes_repo_idx" ON "kg_nodes" ("repo")`);
  statements.push(
    `CREATE INDEX IF NOT EXISTS "kg_nodes_search_idx" ON "kg_nodes" USING gin ("search")`,
  );
  if (options.variant === 'vector') {
    statements.push(`CREATE INDEX IF NOT EXISTS "kg_nodes_embedding_idx" ON "kg_nodes"
  USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64)`);
  }

  statements.push(`CREATE TABLE IF NOT EXISTS "kg_edges" (
  "id"         text PRIMARY KEY,
  "source_id"  text NOT NULL REFERENCES "kg_nodes"("id") ON DELETE CASCADE,
  "target_id"  text NOT NULL REFERENCES "kg_nodes"("id") ON DELETE CASCADE,
  "relation"   text NOT NULL,
  "fact"       text NOT NULL,
  "repo"       text,
  "attributes" jsonb DEFAULT '{}'::jsonb,
  "embedding"  ${embedding},
  "search"     tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("fact", ''))
  ) STORED,
  "valid_at"   timestamptz NOT NULL,
  "invalid_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expired_at" timestamptz
)`);
  statements.push(`CREATE INDEX IF NOT EXISTS "kg_edges_valid_at_idx" ON "kg_edges" ("valid_at")`);
  statements.push(`CREATE INDEX IF NOT EXISTS "kg_edges_repo_idx" ON "kg_edges" ("repo")`);
  statements.push(
    `CREATE INDEX IF NOT EXISTS "kg_edges_search_idx" ON "kg_edges" USING gin ("search")`,
  );
  if (options.variant === 'vector') {
    statements.push(`CREATE INDEX IF NOT EXISTS "kg_edges_embedding_idx" ON "kg_edges"
  USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64)`);
  }
  statements.push(
    `CREATE INDEX IF NOT EXISTS "kg_edges_source_current_idx" ON "kg_edges" ("source_id", "relation") WHERE "invalid_at" IS NULL AND "expired_at" IS NULL`,
  );
  statements.push(
    `CREATE INDEX IF NOT EXISTS "kg_edges_target_current_idx" ON "kg_edges" ("target_id", "relation") WHERE "invalid_at" IS NULL AND "expired_at" IS NULL`,
  );

  statements.push(`CREATE TABLE IF NOT EXISTS "kg_edge_episodes" (
  "edge_id"    text NOT NULL REFERENCES "kg_edges"("id") ON DELETE CASCADE,
  "episode_id" text NOT NULL REFERENCES "kg_episodes"("id") ON DELETE CASCADE,
  PRIMARY KEY ("edge_id", "episode_id")
)`);
  statements.push(
    `CREATE INDEX IF NOT EXISTS "kg_edge_episodes_episode_idx" ON "kg_edge_episodes" ("episode_id")`,
  );

  statements.push(`CREATE TABLE IF NOT EXISTS "kg_node_aliases" (
  "alias"   text NOT NULL,
  "node_id" text NOT NULL REFERENCES "kg_nodes"("id") ON DELETE CASCADE,
  PRIMARY KEY ("alias", "node_id")
)`);

  statements.push(`CREATE TABLE IF NOT EXISTS "kg_outbox" (
  "seq"        bigserial PRIMARY KEY,
  "site_id"    text NOT NULL,
  "op"         jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "pushed_at"  timestamptz
)`);
  statements.push(
    `CREATE INDEX IF NOT EXISTS "kg_outbox_pushed_at_idx" ON "kg_outbox" ("pushed_at")`,
  );

  return statements;
}
