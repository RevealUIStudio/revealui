/**
 * CRDT Operations Table
 *
 * Stores CRDT operations for sync, conflict resolution, and audit trail.
 * This enables offline-first operation and true conflict resolution by
 * replaying operations rather than just merging final states.
 */

import { bigint, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// =============================================================================
// CRDT Operations Table
// =============================================================================

export const crdtOperations = pgTable(
  'crdt_operations',
  {
    /** Unique operation ID */
    id: text('id').primaryKey(),

    /** CRDT instance identifier (e.g., "working-memory:session:abc123") */
    crdtId: text('crdt_id').notNull(),

    /** Type of CRDT: 'lww_register', 'or_set', 'pn_counter' */
    crdtType: text('crdt_type').notNull(),

    /** Type of operation: 'set', 'add', 'remove', 'increment', 'decrement' */
    operationType: text('operation_type').notNull(),

    /** Operation payload (JSONB) */
    payload: jsonb('payload').notNull(),

    /** Node ID that performed this operation */
    nodeId: text('node_id').notNull(),

    /** Unix timestamp (milliseconds) for ordering */
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),

    /** When this operation was recorded */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('crdt_operations_crdt_id_idx').on(table.crdtId),
    index('crdt_operations_node_id_idx').on(table.nodeId),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type CRDTOperation = typeof crdtOperations.$inferSelect;
export type NewCRDTOperation = typeof crdtOperations.$inferInsert;
