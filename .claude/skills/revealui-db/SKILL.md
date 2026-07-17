---
name: revealui-db
description: |
  RevealUI database conventions for any task involving database, schema, query, migration,
  Drizzle ORM, Neon, PostgreSQL, pgvector, vectors, embeddings, or data modeling.
  Covers the single Neon-primary database and its pgvector tables.
---

# Database Conventions

## Database Architecture

RevealUI runs a **single Neon-primary PostgreSQL database** (Drizzle ORM), with vector data (agent memories + RAG) stored in that same database via pgvector and live sync provided by ElectricSQL:

| Database | Client | Purpose |
|----------|--------|---------|
| **Neon** (PostgreSQL) | `@neondatabase/serverless` (falls back to `node-postgres` for localhost) | All data: collections, users, sessions, orders, products, plus pgvector tables (agent memories, RAG) |
| **ElectricSQL** | `@electric-sql` | Live read-path sync over the same Neon database |

## Boundary Rule

There is no second database client. All persistence goes through the single Drizzle/Neon client (`@revealui/db`); vector data lives in pgvector on the same Neon database, so there is no separate vector/auth client to import. (A customer-facing Supabase MCP adapter exists for connecting a customer's OWN Supabase project as a selectable data source — it is never RevealUI's internal store.)

## Schema Organization

```
packages/db/src/schema/
├── collections/    # NeonDB: content collections
├── users/          # NeonDB: user management
├── commerce/       # NeonDB: products, orders, pricing
├── sessions/       # NeonDB: auth sessions
├── vector/         # Neon (pgvector): embeddings, similarity search
└── auth/           # Neon: session-based auth (no separate auth store)
```

## Query Patterns

### NeonDB (Drizzle ORM)
```ts
import { db } from '@revealui/db'
import { posts } from '@revealui/db/schema'

const results = await db.select().from(posts).where(eq(posts.status, 'published'))
```

### Vector queries (pgvector on Neon)
```ts
// Vector tables live on the same Neon database (pgvector)
import { db } from '@revealui/db'
import { agentMemories } from '@revealui/db/schema'

const results = await db.select().from(agentMemories).orderBy(cosineDistance(agentMemories.embedding, queryEmbedding)).limit(5)
```

## Enforcement

The `pnpm validate:structure` script checks package/import-boundary conventions.
CI runs this as part of phase 1 (warn-only — violations are flagged but don't block builds).

To check locally:
```bash
pnpm validate:structure
```

## Migration Guidance

When adding new features:
1. **Content/REST data** → add to `packages/db/src/schema/` + use Drizzle
2. **AI/vector data** → add to `packages/db/src/schema/vector.ts` (pgvector on the same Neon database) + use Drizzle
3. There is a single DB client — no cross-client mixing concern
