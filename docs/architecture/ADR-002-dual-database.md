---
title: "ADR-002: Dual-Database Architecture (NeonDB + Supabase)"
description: "**Date:** 2026-04-08"
visibility: public
status: verified
audience: user
---

# ADR-002: Dual-Database Architecture (NeonDB + Supabase)

**Date:** 2026-04-08
**Status:** Superseded by [2026-05-01-supabase-removal](../decisions/2026-05-01-supabase-removal.md) on 2026-05-01

> **⚠️ Superseded — preserved for history.** The dual-database model was reversed by ADR [`2026-05-01-supabase-removal`](../decisions/2026-05-01-supabase-removal.md): the canonical stack is now **NeonDB primary + ElectricSQL sync**, with Supabase as an optional, being-retired RAG sidecar (Phase 7 consolidates it onto NeonDB `pgvector`). `agent_memories` live in NeonDB, not Supabase. The boundary enforcement described below still applies during the phase-out; do not build net-new features on Supabase-specific behavior.

## Context

RevealUI needs both transactional SQL (users, content, billing, auth) and vector storage (AI embeddings, semantic search). A single database would force compromises: PostgreSQL with pgvector handles both but couples operational and AI workloads. Separate databases isolate failure domains and allow each to scale independently.

## Decision

Two PostgreSQL databases, each with a distinct role:

1. **NeonDB** (primary)  -  All transactional data: users, content, billing, sessions, auth, marketplace. Accessed via Drizzle ORM over HTTP (serverless-compatible). 85 tables. Schema managed by drizzle-kit migrations.

2. **Supabase** (vectors/auth)  -  Vector embeddings for AI memory, semantic search, and agent context. Accessed via the Supabase JS client. Also hosts Supabase Auth for social OAuth flows (GitHub, Google, Vercel) which redirect tokens back to RevealUI's session-based auth.

### Boundary enforcement

The `supabase-boundary.js` pre-tool-use hook and the `boundary.ts` CI validator enforce that `@supabase/supabase-js` imports only appear in permitted paths:
- `packages/db/src/vector/`
- `packages/auth/`
- `packages/ai/`
- `packages/services/src/supabase/`
- `apps/*/src/lib/supabase/`

All other code must go through `@revealui/db` query helpers.

## Alternatives Considered

- **Single NeonDB with pgvector**: Simpler, but couples AI workload latency to transactional queries. Supabase provides managed pgvector + realtime subscriptions that NeonDB doesn't.
- **Supabase only**: Supabase's REST API is slower than NeonDB's serverless driver for high-frequency transactional queries. NeonDB's branching is better for CI/dev workflows.
- **Redis for caching**: Rejected early. PGlite handles in-process caching. No Redis dependency in the stack.

## Consequences

- Two connection strings in env (`POSTGRES_URL` for Neon, `SUPABASE_URL`/`SUPABASE_ANON_KEY` for Supabase)
- Schema is only managed by Drizzle for NeonDB; Supabase schema is managed via Supabase dashboard/migrations separately
- Contributors must understand which database to use (the boundary validator catches mistakes)
