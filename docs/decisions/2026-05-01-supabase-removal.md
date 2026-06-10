---
title: "ADR: Supabase Removal — Single Neon-Primary Database"
description: "**Note**: This ADR is a backfill written 2026-05-16 to document a migration that"
visibility: public
status: verified
audience: user
---

**Note**: This ADR is a backfill written 2026-05-16 to document a migration that
completed incrementally between 2026-04-15 and 2026-05-16.

---

**Date**: 2026-05-01 (backfilled 2026-05-16)
**Status**: Accepted
**Deciders**: RevealUI Studio (single-founder)

---

## Context

RevealUI originally shipped with a dual-database architecture:

- **NeonDB** (via `@neondatabase/serverless` + Drizzle) for relational tables:
  users, sites, pages, sessions, orders, etc.
- **Supabase** for vector storage (`agent_memories`, pgvector) and as a Postgres
  sidecar with a separate connection string (`DATABASE_URL`).

Problems with this architecture:

1. Two database drivers, two connection pools, two env vars (`POSTGRES_URL` +
   `DATABASE_URL`), two Drizzle clients (`getRestClient` + `getVectorClient`).
2. pgvector is available natively on Neon — there was never a technical reason to
   use Supabase as a vector sidecar.
3. Cross-DB reference assertions (`assertCrossDbRefs`, `safeVectorInsert`) added
   complexity to guard against inconsistency between the two stores.
4. The Supabase Realtime feature was never used — ElectricSQL (synced from Neon)
   replaced it as the live-sync layer.
5. Developer friction: two sets of migrations, two connection strings in every
   env file, dual-pool overhead in production.

## Decision

Remove Supabase from the RevealUI runtime stack. Use a single Neon-primary
PostgreSQL database for all data, including vector tables.

Specifics:
- All `agent_memories` and `rag_*` tables moved to Neon (pgvector enabled).
- `getVectorClient()` deprecated alias removed; all callers use `getRestClient()`.
- `DATABASE_URL` env var removed from required set; `POSTGRES_URL` is canonical.
- Dead Supabase setup files (`packages/db/src/supabase/`) deleted.
- Supabase MCP adapter (`packages/mcp/src/servers/supabase.ts`) retained as a
  customer-facing adapter — this is for customers who use Supabase, not internal
  RevealUI infrastructure.

## What Was Removed

As of 2026-05-16 (this PR, `chore/postgres-supabase-cleanup-and-doc-hygiene`):

- `getVectorClient()` function from `packages/db/src/client/index.ts`
- `getVectorClient` re-export from `packages/db/src/index.ts`
- `packages/db/src/supabase/README.md`
- `packages/db/src/supabase/setup-vector-extension.sql`
- All `getVectorClient` call-sites migrated to `getRestClient` across:
  - `apps/server/src/routes/rag-index.ts`
  - `packages/ai/src/memory/vector/vector-memory-service.ts`
  - `packages/ai/src/ingestion/rag-vector-service.ts`
  - `packages/ai/src/__tests__/integration/rag-pipeline.test.ts`
  - `packages/db/src/client/__tests__/dual-client.test.ts`
  - `packages/test/src/integration/memory/dual-database.integration.test.ts`
  - `packages/test/src/integration-pro/memory/test-helpers.ts`
  - `packages/test/src/integration-pro/memory/episodic-memory.integration.test.ts`
  - `packages/test/src/integration-pro/memory/vector-memory.integration.test.ts`
  - `apps/server/src/routes/__tests__/rag-index.test.ts`

## Consequences

**Positive**:
- One database driver, one connection pool, one env var (`POSTGRES_URL`).
- No per-table-source confusion — all Drizzle queries use the same client.
- `assertCrossDbRefs` and `safeVectorInsert` cross-DB guards can be simplified
  in a follow-on PR (out of scope here).
- Integration tests no longer require `DATABASE_URL` to be set separately.

**Neutral**:
- ElectricSQL is unaffected — it has always synced from Neon, not Supabase.
- The Supabase MCP adapter for customers remains in `packages/mcp/`.

**Negative**:
- None identified. Neon pgvector support is GA and production-stable.
