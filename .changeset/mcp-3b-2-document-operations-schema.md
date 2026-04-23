---
'@revealui/db': minor
---

Add `mcp_document_operations` as a Drizzle-tracked schema (`packages/db/src/schema/mcp-document-operations.ts`) with companion migration `0009_mcp_document_operations.sql`.

Operation log for MCP's document-oriented CRDT replication — distinct from the AI memory system's `crdt_operations` (per-CRDT-instance op log for LWW / OR-set / PN-counter primitives). The two tables model different domains and share column names only coincidentally; they must not be reconciled into one.

Schema:
- `id` (text PK)
- `document_id` (text NOT NULL, indexed) — replication scope unit
- `operation_type` (text NOT NULL)
- `payload` (jsonb NOT NULL) — operation delta
- `vector_clock` (jsonb NOT NULL) — causal history `{ nodeId: counter }`
- `node_id` (text NOT NULL, indexed)
- `created_at` (timestamptz DEFAULT NOW() NOT NULL, indexed DESC)
- `applied_at` (timestamptz NULLABLE) — idempotent replay marker

Additive only; no MCP code changes yet. Follow-up PR-3b.3 rewires MCP's integration test to use the new table and re-exports typed helpers. See `.jv/docs/mcp-crdt-reconciliation-design.md` for the full Phase 3b design.
