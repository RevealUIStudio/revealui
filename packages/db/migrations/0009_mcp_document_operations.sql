-- MCP document operations table (Phase 3b.2).
--
-- Operation log for MCP's document-oriented CRDT replication. Deliberately
-- distinct from the AI memory's `crdt_operations` (per-CRDT-instance op log
-- for LWW / OR-set / PN-counter primitives). Shared column names are
-- coincidental; see `.jv/docs/mcp-crdt-reconciliation-design.md` for why
-- these are two tables, not one.
--
-- drizzle-kit generate also emitted catch-up SQL for `users.must_rotate_password`
-- (from 0006) and the `jobs` visibility-timeout columns + partial index (from
-- 0008). Those are already applied by their own migrations and have been
-- stripped here. See `meta/_custom.json` entry for this tag.

CREATE TABLE "mcp_document_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"operation_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"vector_clock" jsonb NOT NULL,
	"node_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "mcp_document_operations_document_id_idx" ON "mcp_document_operations" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "mcp_document_operations_node_id_idx" ON "mcp_document_operations" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "mcp_document_operations_created_at_idx" ON "mcp_document_operations" USING btree ("created_at" DESC NULLS LAST);
