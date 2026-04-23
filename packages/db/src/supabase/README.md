# `@revealui/db` — Supabase-side artifacts

This directory holds Supabase-specific database setup that lives **outside the main drizzle-kit pipeline** by necessity. The main Neon/Postgres schema is tracked in `packages/db/migrations/` and applied by `drizzle-kit migrate` against `POSTGRES_URL`. Supabase is a separate database (different credentials, different purpose — pgvector-backed RAG tables, possibly other embeddings) and currently has its own bootstrap path.

## Files

### `setup-vector-extension.sql`

Enables the `pgvector` extension on the Supabase database. Idempotent (`CREATE EXTENSION IF NOT EXISTS vector`). Applied by `scripts/setup/setup-dual-database.ts`, which runs the vector-side setup once per fresh Supabase project.

**Why this is not a drizzle-kit migration:** drizzle-kit has a single `drizzle.config.ts` pointing at the Neon `POSTGRES_URL`. To track Supabase-side DDL in drizzle-kit would require either (a) a second `drizzle.supabase.config.ts` + dedicated migrations directory + `db:migrate:supabase` script + a parallel CI job, or (b) merging both into one config with dialect flags. Both are legitimate future directions; neither has been built yet. Until then, `setup-dual-database.ts` is the canonical applier for Supabase-side DDL, and this file is the canonical SQL source.

## Relationship to `scripts/setup/setup-dual-database.ts`

The TS script reads this SQL file via `readFileSync` and executes it against `getVectorClient()` (the Supabase-side Drizzle client). It is idempotent — safe to run repeatedly against the same Supabase project.

## Future direction

- **Phase 7 (drizzle-consolidation-spec):** Evaluate whether to stand up a second drizzle-kit pipeline for Supabase, matching the Neon-side pipeline's guarantees (journal, tracked migrations, CI apply-against-ephemeral-Supabase-Postgres).
- **Short-term hardening:** A `supabase-migrations` CI job that provisions a pgvector-enabled Postgres, runs `setup-dual-database.ts --supabase-only` or equivalent, and fails if the script cannot produce a clean Supabase schema. Analogous to the `db-migrations` CI job added in #455 for the Neon side.

## See also

- `.jv/docs/raw-sql-migration-plan.md` — Phase 4b.2 (this relocation) and Phase 7 (consolidation).
- `scripts/validate/raw-sql-allowlist.json` — `setup-vector-extension.sql` is allowlisted with `migrationPhase: 7`.
