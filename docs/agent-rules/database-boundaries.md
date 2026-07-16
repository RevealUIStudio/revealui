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
- `packages/mcp/src/servers/supabase.ts`  -  the Supabase MCP adapter for installer customers who chose Supabase as their own backend; not invoked by RevealUI's internal runtime

As of the current phase-out state, there are zero `@supabase/supabase-js` imports left in `packages/` or `apps/`  -  the path above is the only intentionally-retained integration point, and this boundary governs any future addition.

### Forbidden: Supabase imports in
- `packages/core/`  -  Runtime engine must be DB-agnostic
- `packages/contracts/`  -  contracts are schema-only
- `packages/config/`  -  config must not hardcode DB client
- `apps/admin/src/collections/`  -  collection hooks use Drizzle/Neon only
- `apps/admin/src/routes/`  -  REST routes use Neon only

## Schema Organization

`packages/db/src/schema/` is a flat set of `.ts` files, one table (or closely related group of tables) per file  -  no subdirectories. Representative files:

```
packages/db/src/schema/
├── users.ts           # NeonDB: user management
├── accounts.ts         # NeonDB: accounts, subscriptions, entitlements
├── products.ts         # NeonDB: commerce products
├── sites.ts             # NeonDB: content collections / sites
├── vector.ts            # NeonDB pgvector: embeddings, similarity search
├── webhook-events.ts    # NeonDB: processed Stripe webhook idempotency
└── licenses.ts          # NeonDB: license records
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

No automated check currently scans for Supabase imports outside the permitted path. `scripts/validate/structure.ts` and `scripts/validate/boundary.ts` (the scripts behind `pnpm validate:structure`) do not contain a Supabase-import rule. The boundary above is enforced by convention and code review, not by CI, until such a check is added.

## Migration Guidance

When adding new features:
1. **All data (content, REST, AI/vector)** → add to `packages/db/src/schema/` + use Drizzle on NeonDB (vectors via `pgvector`)
2. **Do not add new Supabase-coupled code** — Supabase is being retired (ADR 2026-05-01). Net-new features must target NeonDB.
3. The optional Supabase RAG sidecar, where still wired, stays behind the import boundary above.
