# Database Conventions

## Dual-Database Architecture

RevealUI uses **two databases with strictly separated responsibilities**:

| Database | Client | Purpose |
|----------|--------|---------|
| **NeonDB** (PostgreSQL) | `@neondatabase/serverless` | REST content: collections, users, sessions, orders, products |
| **Supabase** | `@supabase/supabase-js` | Vector embeddings, real-time auth, AI memory storage |

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
├── vector/         # Supabase: embeddings, similarity search
└── auth/           # Supabase: auth state
```

## Query Patterns

### NeonDB (Drizzle ORM)
```ts
import { db } from '@revealui/db'
import { posts } from '@revealui/db/schema'

const results = await db.select().from(posts).where(eq(posts.status, 'published'))
```

### Supabase (vector/auth only)
```ts
// Only in designated modules (packages/db/src/vector/, packages/ai/src/)
import { createSupabaseClient } from '@revealui/db/vector'

const { data } = await supabase.rpc('match_documents', { query_embedding: embedding })
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
1. **Content/REST data** → add to `packages/db/src/schema/` + use Drizzle
2. **AI/vector data** → add to `packages/db/src/vector/` + use Supabase client
3. **Never mix** both DB clients in the same module
