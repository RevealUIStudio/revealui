-- Fleet Knowledge Graph FTS fix (GAP-349) — kg_nodes.search_text.
--
-- Postgres's `english` tsvector parser tokenizes path-like and hyphenated
-- names as a single opaque token (`electric-proxy.ts`, and naturalKeys like
-- `apps/admin/src/lib/api/electric-proxy.ts`), so word-level queries like
-- "electric proxy" never matched via `websearch_to_tsquery` against the old
-- `search` column (generated from name + summary only). This migration adds
-- `search_text` — a normalized rendering of name + naturalKey + summary,
-- populated at write time by the ingest engine (separators → spaces,
-- camelCase boundaries → spaces; see @revealui/knowledge-graph
-- src/search/normalize-text.ts) — and repoints the generated `search`
-- tsvector at it.
--
-- kg_nodes carries real rows on Neon (the first fleet scans already ran), so
-- this migration both adds the column AND backfills existing rows, then
-- rebuilds the generated `search` column (Postgres has no
-- `ALTER COLUMN ... SET EXPRESSION`, so the generated column must be dropped
-- and recreated).
--
-- Backfill scope: this migration's SQL backfill applies SEPARATOR
-- normalization only (`/ - _ .` → space via plain `replace()` calls, no
-- regex, per the fleet no-regex rule) to existing rows. camelCase-boundary
-- splitting (e.g. `getPoolStats` → `get Pool Stats`) requires a character
-- walk that plain SQL string functions cannot express without regex, so it
-- is NOT backfilled here — it lands automatically for a given node the next
-- time a scan re-upserts that node (the ingest engine always writes the full
-- separator+camelCase normalization via `buildSearchText`, and node upsert
-- is `search_text = EXCLUDED.search_text`, i.e. always overwritten). Existing
-- rows are fully queryable for separator-boundary word search immediately;
-- camelCase-boundary word search completes incrementally as scans re-run.
--
-- Ships UNAPPLIED — owner applies. Idempotent: safe to re-run (ADD COLUMN /
-- DROP COLUMN / CREATE INDEX all use IF EXISTS / IF NOT EXISTS).

ALTER TABLE "kg_nodes" ADD COLUMN IF NOT EXISTS "search_text" text NOT NULL DEFAULT '';

UPDATE "kg_nodes" SET "search_text" =
  coalesce("name", '') || ' ' ||
  replace(replace(replace(replace(coalesce("name", ''), '/', ' '), '-', ' '), '_', ' '), '.', ' ') || ' ' ||
  replace(replace(replace(replace(coalesce("natural_key", ''), '/', ' '), '-', ' '), '_', ' '), '.', ' ') || ' ' ||
  replace(replace(replace(replace(coalesce("summary", ''), '/', ' '), '-', ' '), '_', ' '), '.', ' ')
WHERE "search_text" = '';

ALTER TABLE "kg_nodes" DROP COLUMN IF EXISTS "search";

ALTER TABLE "kg_nodes" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (
  to_tsvector('english', coalesce("search_text", ''))
) STORED;

CREATE INDEX IF NOT EXISTS "kg_nodes_search_idx" ON "kg_nodes" USING gin ("search");
