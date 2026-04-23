/**
 * MCP Document Operations Table
 *
 * Operation log for MCP's document-oriented CRDT replication. Each row is an
 * operation-based delta against a replicated document, tagged with the node
 * that produced it, a vector clock for causal ordering across replicas, and
 * an optional `appliedAt` timestamp for idempotent local replay.
 *
 * This is distinct from `crdtOperations` in `./crdt-operations.ts`, which is
 * `@revealui/ai`'s per-CRDT-instance operation log for memory primitives
 * (LWW register, OR-set, PN counter). Shared column names (`operation_type`,
 * `node_id`, `payload`) are coincidental; the tables model different domains
 * and must not be reconciled into one.
 *
 * See `.jv/docs/mcp-crdt-reconciliation-design.md` (Phase 3b) for context.
 */

import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// =============================================================================
// MCP Document Operations Table
// =============================================================================

export const mcpDocumentOperations = pgTable(
  'mcp_document_operations',
  {
    /** Unique operation ID */
    id: text('id').primaryKey(),

    /** Document being replicated (MCP's scope unit) */
    documentId: text('document_id').notNull(),

    /** Type of operation (free-form; consumers validate) */
    operationType: text('operation_type').notNull(),

    /** Operation payload (JSONB delta) */
    payload: jsonb('payload').notNull(),

    /** Vector clock for causal ordering: `{ nodeId: counter }` */
    vectorClock: jsonb('vector_clock').notNull(),

    /** Node that produced this operation */
    nodeId: text('node_id').notNull(),

    /** When the operation was recorded */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /** When the operation was applied locally; null until replayed */
    appliedAt: timestamp('applied_at', { withTimezone: true }),
  },
  (table) => [
    index('mcp_document_operations_document_id_idx').on(table.documentId),
    index('mcp_document_operations_node_id_idx').on(table.nodeId),
    index('mcp_document_operations_created_at_idx').on(table.createdAt.desc()),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type McpDocumentOperation = typeof mcpDocumentOperations.$inferSelect;
export type NewMcpDocumentOperation = typeof mcpDocumentOperations.$inferInsert;
