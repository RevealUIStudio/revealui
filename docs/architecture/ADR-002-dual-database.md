---
title: "ADR-002: Dual-Database Architecture (NeonDB + Supabase)"
description: "**Date:** 2026-04-08"
visibility: public
status: verified
audience: user
---

**Date:** 2026-04-08
**Status:** Superseded by [2026-05-01-supabase-removal](../decisions/2026-05-01-supabase-removal.md) on 2026-05-01

> **⚠️ Superseded, preserved for history.** The dual-database model was reversed by ADR [`2026-05-01-supabase-removal`](../decisions/2026-05-01-supabase-removal.md): the canonical stack is now **NeonDB primary + ElectricSQL sync**, with Supabase as an optional, being-retired RAG sidecar (Phase 7 consolidates it onto NeonDB `pgvector`). `agent_memories` live in NeonDB, not Supabase. The `supabase-boundary.js` hook and `boundary.ts` CI validator described below never shipped as automated mechanisms; the boundary is enforced by convention and review (see `docs/agent-rules/database-boundaries.md`). Do not build net-new features on Supabase-specific behavior.

## Context

RevealUI needs both transactional SQL (users, content, billing, auth) and vector storage (AI embeddings, semantic search). A single database would force compromises: PostgreSQL with pgvector handles both but couples operational and AI workloads. Separate databases isolate failure domains and allow each to scale independently.

## Decision

Two PostgreSQL databases, each with a distinct role:

1. **NeonDB** (primary)  -  All transactional data: users, content, billing, sessions, auth, marketplace. Accessed via Drizzle ORM over HTTP (serverless-compatible). 93 tables. Schema managed by drizzle-kit migrations.

2. **Supabase** (vectors/auth)  -  Vector embeddings for AI memory, semantic search, and agent context. Accessed via the Supabase JS client. Also hosts Supabase Auth for social OAuth flows (GitHub, Google, Vercel) which redirect tokens back to RevealUI's session-based auth.

### Boundary enforcement (as originally proposed; not built as automation, see banner above)

The ADR proposed a `supabase-boundary.js` pre-tool-use hook and a `boundary.ts` CI validator to enforce that `@supabase/supabase-js` imports only appear in permitted paths:
- `packages/db/src/vector/`
- `packages/auth/`
- `packages/ai/`
- `packages/services/src/supabase/`
- `apps/*/src/lib/supabase/`

Neither mechanism was ever implemented; `scripts/validate/structure.ts:1` and `scripts/validate/boundary.ts:1` contain no Supabase-import check. All other code must go through `@revealui/db` query helpers; the current boundary rule (convention plus review) lives in `docs/agent-rules/database-boundaries.md`.

## Alternatives Considered

- **Single NeonDB with pgvector**: Simpler, but couples AI workload latency to transactional queries. Supabase provides managed pgvector + realtime subscriptions that NeonDB doesn't.
- **Supabase only**: Supabase's REST API is slower than NeonDB's serverless driver for high-frequency transactional queries. NeonDB's branching is better for CI/dev workflows.
- **Redis for caching**: Rejected early. PGlite handles in-process caching. No Redis dependency in the stack.

## Consequences

- Two connection strings in env (`POSTGRES_URL` for Neon, `SUPABASE_URL`/`SUPABASE_ANON_KEY` for Supabase)
- Schema is only managed by Drizzle for NeonDB; Supabase schema is managed via Supabase dashboard/migrations separately
- Contributors must understand which database to use (the boundary validator catches mistakes)
