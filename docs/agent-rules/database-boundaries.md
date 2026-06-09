---
title: "Database Conventions"
description: "**`@supabase/supabase-js` must only be imported inside designated vector/auth modules:**"
visibility: internal
status: verified
audience: agent
---

## Database Architecture (NeonDB primary; Supabase being retired)

> **Status:** per ADR [`2026-05-01-supabase-removal`](../decisions/2026-05-01-supabase-removal.md), the canonical stack is **NeonDB primary + ElectricSQL sync, no Supabase**. NeonDB holds everything, including vector embeddings and `agent_memories` (via `pgvector`). Supabase is a legacy, optional sidecar being phased out (Phase 7). The import boundary below remains **enforced during the phase-out** so no new code couples to Supabase.

| Database | Client | Purpose |
|----------|--------|---------|
| **NeonDB** (PostgreSQL) | `@neondatabase/serverless` | Primary store: collections, users, sessions, orders, products, **plus vector embeddings + `agent_memories` via `pgvector`** |
| **Supabase** (legacy, being retired) | `@supabase/supabase-js` | Optional RAG-chunk sidecar only; import-restricted during the phase-out |

## Boundary Rule

**`@supabase/supabase-js` must only be imported inside designated vector/auth modules:**

### Allowed paths for Supabase imports
- `packages/db/src/vector/`  -  vector schema and queries
- `packages/db/src/auth/`  -  Supabase auth helpers
- `packages/auth/src/`  -  authentication implementation
- `packages/ai/src/`  -  AI memory and embedding storage
- `packages/services/src/supabase/`  -  Supabase service integrations
- `apps/*/src/lib/supabase/`  -  app-level Supabase utilities

### Forbidden: Supabase imports in
- `packages/core/`  -  Runtime engine must be DB-agnostic
- `packages/contracts/`  -  contracts are schema-only
- `packages/config/`  -  config must not hardcode DB client
- `apps/admin/src/collections/`  -  collection hooks use Drizzle/Neon only
- `apps/admin/src/routes/`  -  REST routes use Neon only

## Schema Organization

```
packages/db/src/schema/
├── collections/    # NeonDB: content collections
├── users/          # NeonDB: user management
├── commerce/       # NeonDB: products, orders, pricing
├── sessions/       # NeonDB: auth sessions
├── vector/         # NeonDB pgvector: embeddings, similarity search
└── auth/           # NeonDB: session-based auth state
```

## Query Patterns

### NeonDB (Drizzle ORM)
```ts
import { getRestClient } from '@revealui/db'
import { posts } from '@revealui/db/schema'

const db = getRestClient()
const results = await db.select().from(posts).where(eq(posts.status, 'published'))
```

### Vector queries (pgvector on NeonDB)
```ts
// Vector ops run on the same NeonDB client as REST after Supabase removal
// (see docs/decisions/2026-05-01-supabase-removal.md)
import { getRestClient } from '@revealui/db'
import { agentMemories } from '@revealui/db/schema/vector'
import { sql } from 'drizzle-orm'

const db = getRestClient()
const matches = await db
  .select()
  .from(agentMemories)
  .orderBy(sql`embedding <-> ${queryEmbedding}::vector`)
  .limit(10)
```

## Enforcement

The `pnpm validate:structure` script checks for Supabase imports outside permitted paths.
CI runs this as part of phase 1 (warn-only  -  violations are flagged but don't block builds).

To check locally:
```bash
pnpm validate:structure
```

## Migration Guidance

When adding new features:
1. **All data (content, REST, AI/vector)** → add to `packages/db/src/schema/` + use Drizzle on NeonDB (vectors via `pgvector`)
2. **Do not add new Supabase-coupled code** — Supabase is being retired (ADR 2026-05-01). Net-new features must target NeonDB.
3. The optional Supabase RAG sidecar, where still wired, stays behind the import boundary above.
