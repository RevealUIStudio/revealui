---
"@revealui/db": minor
---

**BREAKING (pre-1.0):** `SUPABASE_DATABASE_URL` is now required for vector queries — no longer falls back silently to `DATABASE_URL`. Prevents vector data routing to the wrong database in misconfigured deployments. Restore pool cleanup handler for graceful shutdown (SIGTERM/SIGINT/beforeExit). Add HNSW index for `rag_chunks.embedding` in Supabase vector setup SQL.
