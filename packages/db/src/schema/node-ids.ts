/**
 * Node ID Mappings Table
 *
 * Stores mappings between entity IDs (session/user) and their deterministic node IDs.
 * Used for CRDT operations to ensure consistent node IDs across requests.
 *
 * Strategy: Hybrid approach
 * - Primary: SHA-256 hash of entityId (deterministic, fast)
 * - Fallback: Database lookup for collision resolution and manual management
 */

import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const nodeIdMappings = pgTable(
  'node_id_mappings',
  {
    // SHA-256 hash of entityId (primary key for fast lookup)
    id: text('id').primaryKey(),

    // Entity type: 'session' or 'user'
    entityType: text('entity_type').notNull(),

    // Original entity ID (sessionId or userId)
    entityId: text('entity_id').notNull(),

    // Actual node ID (UUID) used in CRDT operations
    nodeId: text('node_id').notNull().unique(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [check('node_id_mappings_entity_type_check', sql`entity_type IN ('session', 'user')`)],
);

// =============================================================================
// Type Exports
// =============================================================================

export type NodeIdMapping = typeof nodeIdMappings.$inferSelect;
export type NewNodeIdMapping = typeof nodeIdMappings.$inferInsert;
