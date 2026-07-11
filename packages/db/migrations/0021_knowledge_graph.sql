-- Fleet Knowledge Graph (GAP-340 P1) — bi-temporal, content-addressed graph tables.
--
-- Hand-written (see meta/_custom.json): the pgvector columns, HNSW indexes,
-- tsvector generated columns, GIN indexes, and partial current-edge indexes
-- cannot be expressed in Drizzle's schema DSL. Companion Drizzle schema at
-- packages/db/src/schema/knowledge-graph.ts models the plain columns for ORM
-- typing; retrieval that touches vectors / tsvector / partial indexes uses raw
-- SQL through @revealui/knowledge-graph.
--
-- All statements are idempotent (IF NOT EXISTS / GENERATED column). Ships
-- UNAPPLIED — validated only against PGlite in @revealui/knowledge-graph tests.
-- pgvector must be installed on the target (CREATE EXTENSION owned by 0000).

-- ---------------------------------------------------------------------------
-- kg_episodes — immutable provenance (class 1: content-addressed G-Set)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "kg_episodes" (
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
);

CREATE INDEX IF NOT EXISTS "kg_episodes_source_idx" ON "kg_episodes" ("source");
CREATE INDEX IF NOT EXISTS "kg_episodes_reference_time_idx" ON "kg_episodes" ("reference_time");

-- ---------------------------------------------------------------------------
-- kg_nodes — entities (deterministic id; class 2 monotonic temporal columns)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "kg_nodes" (
  "id"                text PRIMARY KEY,
  "kind"              text NOT NULL,
  "name"              text NOT NULL,
  "natural_key"       text NOT NULL,
  "repo"              text,
  "summary"           text,
  "attributes"        jsonb DEFAULT '{}'::jsonb,
  "attributes_clock"  jsonb DEFAULT '{}'::jsonb,
  "embedding"         vector(768),
  "search"            tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("summary", '')), 'B')
  ) STORED,
  "first_seen_at"     timestamptz NOT NULL,
  "last_confirmed_at" timestamptz NOT NULL,
  "deleted_at"        timestamptz,
  "created_at"        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "kg_nodes_natural_key_idx" ON "kg_nodes" ("natural_key");
CREATE INDEX IF NOT EXISTS "kg_nodes_kind_natural_key_idx" ON "kg_nodes" ("kind", "natural_key");
CREATE INDEX IF NOT EXISTS "kg_nodes_repo_idx" ON "kg_nodes" ("repo");
CREATE INDEX IF NOT EXISTS "kg_nodes_search_idx" ON "kg_nodes" USING gin ("search");
CREATE INDEX IF NOT EXISTS "kg_nodes_embedding_idx" ON "kg_nodes"
  USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ---------------------------------------------------------------------------
-- kg_edges — bi-temporal facts (class 1 id; never deleted, supersede in place)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "kg_edges" (
  "id"         text PRIMARY KEY,
  "source_id"  text NOT NULL REFERENCES "kg_nodes"("id") ON DELETE CASCADE,
  "target_id"  text NOT NULL REFERENCES "kg_nodes"("id") ON DELETE CASCADE,
  "relation"   text NOT NULL,
  "fact"       text NOT NULL,
  "repo"       text,
  "attributes" jsonb DEFAULT '{}'::jsonb,
  "embedding"  vector(768),
  "search"     tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("fact", ''))
  ) STORED,
  "valid_at"   timestamptz NOT NULL,
  "invalid_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expired_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "kg_edges_valid_at_idx" ON "kg_edges" ("valid_at");
CREATE INDEX IF NOT EXISTS "kg_edges_repo_idx" ON "kg_edges" ("repo");
CREATE INDEX IF NOT EXISTS "kg_edges_search_idx" ON "kg_edges" USING gin ("search");
CREATE INDEX IF NOT EXISTS "kg_edges_embedding_idx" ON "kg_edges"
  USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- Current edges only (invalid_at IS NULL AND expired_at IS NULL): the hot path
-- for traversal + "what is true now" queries.
CREATE INDEX IF NOT EXISTS "kg_edges_source_current_idx" ON "kg_edges" ("source_id", "relation")
  WHERE "invalid_at" IS NULL AND "expired_at" IS NULL;
CREATE INDEX IF NOT EXISTS "kg_edges_target_current_idx" ON "kg_edges" ("target_id", "relation")
  WHERE "invalid_at" IS NULL AND "expired_at" IS NULL;

-- ---------------------------------------------------------------------------
-- kg_edge_episodes — provenance join (class 1: insert-only G-Set)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "kg_edge_episodes" (
  "edge_id"    text NOT NULL REFERENCES "kg_edges"("id") ON DELETE CASCADE,
  "episode_id" text NOT NULL REFERENCES "kg_episodes"("id") ON DELETE CASCADE,
  PRIMARY KEY ("edge_id", "episode_id")
);

CREATE INDEX IF NOT EXISTS "kg_edge_episodes_episode_idx" ON "kg_edge_episodes" ("episode_id");

-- ---------------------------------------------------------------------------
-- kg_node_aliases — entity resolution (class 1: insert-only G-Set)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "kg_node_aliases" (
  "alias"   text NOT NULL,
  "node_id" text NOT NULL REFERENCES "kg_nodes"("id") ON DELETE CASCADE,
  PRIMARY KEY ("alias", "node_id")
);

-- ---------------------------------------------------------------------------
-- kg_outbox — per-site op log for offline replay (class 1)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "kg_outbox" (
  "seq"        bigserial PRIMARY KEY,
  "site_id"    text NOT NULL,
  "op"         jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "pushed_at"  timestamptz
);

CREATE INDEX IF NOT EXISTS "kg_outbox_pushed_at_idx" ON "kg_outbox" ("pushed_at");
