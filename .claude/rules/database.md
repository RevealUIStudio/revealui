# Database Conventions

## Primary Store: NeonDB (PostgreSQL)

RevealUI uses **NeonDB as the primary store** via Drizzle ORM. The schema lives in `packages/db/src/schema/` (86 tables) and migrates via standard `drizzle-kit migrate`.

Legacy `@supabase/supabase-js` code has been phased out from runtime — there are zero `from '@supabase/supabase-js'` imports left in `packages/` or `apps/`. **New features must not introduce a Supabase dependency.**

## Schema Organization

Schemas live under `packages/db/src/schema/` — one file per logical domain (accounts, users, sites, posts, agents, RAG, billing, etc.). Use Drizzle ORM for all queries.

```ts
import { db } from '@revealui/db'
import { posts } from '@revealui/db/schema'

const results = await db.select().from(posts).where(eq(posts.status, 'published'))
```

## Vector / Embedding Storage

Vector embeddings (RAG, AI memory) live in NeonDB on the `pgvector` extension. HNSW indexes are created in `0002_triggers_search_vectors.sql`. Tables: `rag_documents`, `rag_chunks`, `agent_memories.embedding`.

## Database MCP

Agent database tooling uses Neon MCP. The legacy customer Supabase MCP adapter was removed; do not reintroduce `supabase-mcp` or `@supabase/supabase-js` into the app code.

## Migration Discipline

See `packages/db/docs/migrations-discipline.md`. The `pnpm validate:migrations` static check enforces:
- Every `.sql` file has a journal entry, and vice versa
- Journal `when` values are strictly increasing
- Every journal entry has a `meta/<NNNN>_snapshot.json` (or an explicit allowlist entry in `meta/_custom.json`)
- `ALTER TABLE ... ADD CONSTRAINT` is wrapped in `DO $$ BEGIN ... EXCEPTION ... END $$` blocks for idempotency
- `DROP CONSTRAINT` uses `IF EXISTS`
