-- Custom migration: triggers, search vectors, HNSW indexes
-- These are PostgreSQL features that can't be expressed in Drizzle's schema DSL.
-- All statements are idempotent (IF NOT EXISTS / CREATE OR REPLACE).

-- ---------------------------------------------------------------------------
-- 1. Full-text search: posts
-- ---------------------------------------------------------------------------

ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

CREATE INDEX IF NOT EXISTS "posts_search_idx" ON "posts" USING gin("search_vector");

CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.slug, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_search_update ON "posts";
CREATE TRIGGER posts_search_update
  BEFORE INSERT OR UPDATE OF title, slug ON "posts"
  FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();

-- Backfill existing rows
UPDATE "posts" SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(slug, '')), 'B')
WHERE search_vector IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Full-text search: pages
-- ---------------------------------------------------------------------------

ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

CREATE INDEX IF NOT EXISTS "pages_search_idx" ON "pages" USING gin("search_vector");

CREATE OR REPLACE FUNCTION pages_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.slug, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pages_search_update ON "pages";
CREATE TRIGGER pages_search_update
  BEFORE INSERT OR UPDATE OF title, slug ON "pages"
  FOR EACH ROW EXECUTE FUNCTION pages_search_vector_update();

UPDATE "pages" SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(slug, '')), 'B')
WHERE search_vector IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Page count trigger (maintains sites.page_count automatically)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION page_count_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NULL THEN
      UPDATE sites
        SET page_count = GREATEST(COALESCE(page_count, 0) + 1, 0)
        WHERE id = NEW.site_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE sites
        SET page_count = GREATEST(COALESCE(page_count, 0) - 1, 0)
        WHERE id = NEW.site_id;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE sites
        SET page_count = GREATEST(COALESCE(page_count, 0) + 1, 0)
        WHERE id = NEW.site_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS page_count_trigger ON "pages";
CREATE TRIGGER page_count_trigger
  AFTER INSERT OR UPDATE ON "pages"
  FOR EACH ROW EXECUTE FUNCTION page_count_trigger_fn();

-- ---------------------------------------------------------------------------
-- 4. Audit log immutability trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % operations are not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutable ON "audit_log";
CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- ---------------------------------------------------------------------------
-- 5. HNSW indexes for vector similarity (Supabase)
--    These require pgvector extension. On databases without pgvector,
--    these statements will fail safely (the tables won't have vector columns).
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "agent_memories_embedding_idx"
  ON "agent_memories"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
EXCEPTION WHEN undefined_column OR undefined_object THEN
  -- pgvector not available or embedding column missing — skip
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "rag_chunks_embedding_idx"
  ON "rag_chunks"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
EXCEPTION WHEN undefined_column OR undefined_object THEN
  -- pgvector not available or embedding column missing — skip
END $$;
