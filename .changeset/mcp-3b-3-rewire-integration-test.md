---
'@revealui/mcp': patch
---

Restore typed helpers for the `mcp_document_operations` table and rewire the integration test to target it.

- `McpDocumentOperationsInsert` and `McpDocumentOperationsRow` are re-exported from `@revealui/mcp` (and `@revealui/mcp/db`). These are the Drizzle-generated source-of-truth types from the schema landed in PR-3b.2, so consumers get column-accurate typing without a separate `@revealui/contracts` import.
- `packages/mcp/__tests__/crdt.integration.test.ts` renamed to `packages/mcp/__tests__/mcp-document-operations.integration.test.ts`. The dormant skip-by-default integration block is restored and all queries retargeted from `crdt_operations` to `mcp_document_operations`. A new `applied_at` marker test documents the idempotent-replay semantic. The block activates when `TEST_DATABASE_URL` points at a Postgres with the `0009_mcp_document_operations` migration applied; otherwise it skips, keeping `pnpm test` hermetic.

Closes Phase 3b of the raw-SQL migration arc. Design doc: `.jv/docs/mcp-crdt-reconciliation-design.md`.
