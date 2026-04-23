---
'@revealui/mcp': minor
---

Delete the raw-SQL `CRDT_TABLE_SQL` bootstrap from `connectPglite()` and `connectPostgres()`.

These factories previously executed a `CREATE TABLE IF NOT EXISTS crdt_operations (...)` statement at connect time with a document-oriented shape (`document_id`, `vector_clock`, `applied_at`) that conflicted silently with the operation-log shape (`crdt_id`, `crdt_type`, `timestamp`) that `@revealui/db` migrates into the same-named table. No MCP server invokes the factories today, but the collision was a real latent failure mode for any external caller.

**Breaking behavior:** after upgrade, `connectPglite()` / `connectPostgres()` / `createMcpDbClient()` no longer bootstrap any tables. Callers must apply drizzle-kit migrations (or the PGlite equivalent) before issuing queries. There are no known external consumers.

**Removed type re-exports:** `CrdtOperationsInsert` and `CrdtOperationsRow` are no longer re-exported from `@revealui/mcp` or `@revealui/mcp/db`. They were Drizzle-`crdt_operations`-shaped typings that did not match the document-oriented SQL the adapter actually ran — keeping them around was a type-checker lie. Import the canonical types from `@revealui/contracts` directly if still needed.

See `.jv/docs/mcp-crdt-reconciliation-design.md` for the full Phase 3b design. Two follow-up PRs land the replacement:

- **3b.2** — add `mcp_document_operations` as a Drizzle-tracked schema + migration.
- **3b.3** — rewire MCP's integration test to the new table and re-export typed helpers.
