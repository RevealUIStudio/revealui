---
title: "Database Conventions"
description: "NeonDB primary + ElectricSQL sync. Supabase was removed (ADR 2026-05-01); do not reintroduce @supabase/supabase-js."
visibility: internal
status: verified
audience: agent
---

## Database Architecture (NeonDB primary; Supabase removed)

> **Status:** per ADR [`2026-05-01-supabase-removal`](../decisions/2026-05-01-supabase-removal.md), the canonical stack is **NeonDB primary + ElectricSQL sync, no Supabase**. NeonDB holds everything, including vector embeddings and `agent_memories` (via `pgvector`). Supabase was removed as architecture. Do not reintroduce it.

| Database | Client | Purpose |
|----------|--------|---------|
| **NeonDB** (PostgreSQL) | `@neondatabase/serverless` | Primary store: collections, users, sessions, orders, products, **plus vector embeddings + `agent_memories` via `pgvector`** |
| ~~Supabase~~ (removed) | (none in tree) | Removed. Do not reintroduce `@supabase/supabase-js` imports. |

## Boundary Rule

**Do not import `@supabase/supabase-js` anywhere.** Supabase was removed; there is no allowed path.

The customer Supabase MCP adapter (`packages/mcp/src/servers/supabase.ts`) was removed. There are zero `@supabase/supabase-js` imports left in `packages/` or `apps/`. Never reintroduce either.

### Surfaces that must stay Neon/Drizzle-only
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

No automated check currently bans reintroduction of removed Supabase imports. `scripts/validate/structure.ts` and `scripts/validate/boundary.ts` (the scripts behind `pnpm validate:structure`) do not contain a Supabase-import rule. The boundary above is enforced by convention and code review, not by CI, until such a check is added.

## Migration Guidance

When adding new features:
1. **All data (content, REST, AI/vector)** → add to `packages/db/src/schema/` + use Drizzle on NeonDB (vectors via `pgvector`)
2. **Do not add Supabase-coupled code** — Supabase was removed (ADR 2026-05-01). Net-new features must target NeonDB only.
3. There is no supported Supabase RAG path; vectors and memories are NeonDB `pgvector`.
