/**
 * Shared Facts table - Append-only agent discovery log for multi-agent coordination.
 *
 * When agent A discovers "file X has bug Y," all concurrent agents see it
 * in real-time via ElectricSQL shape subscriptions. Facts are scoped to a
 * coordination session so only agents working on the same task share context.
 *
 * Layer 1 of the multi-agent shared memory architecture.
 */

import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';

// =============================================================================
// Shared Facts Table
// =============================================================================

export const sharedFacts = pgTable(
  'shared_facts',
  {
    id: text('id').primaryKey(),

    // Coordination session scope - all agents in the same session see these facts
    sessionId: text('session_id').notNull(),

    // Agent that discovered this fact
    agentId: text('agent_id').notNull(),

    // The fact itself
    content: text('content').notNull(),

    // Classification
    factType: text('fact_type').notNull(),

    // How certain the agent is (0-1)
    confidence: real('confidence').default(1.0).notNull(),

    // Free-form tags for filtering and grouping
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),

    // Source reference (file path, line number, tool that produced it)
    sourceRef: jsonb('source_ref').$type<Record<string, unknown>>(),

    // Layer 3: reconciliation marks superseded facts
    supersededBy: text('superseded_by'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('shared_facts_session_id_idx').on(table.sessionId),
    index('shared_facts_agent_id_idx').on(table.agentId),
    index('shared_facts_fact_type_idx').on(table.factType),
    index('shared_facts_created_at_idx').on(table.createdAt),
    check(
      'shared_facts_fact_type_check',
      sql`fact_type IN ('discovery', 'bug', 'decision', 'warning', 'question', 'answer')`,
    ),
  ],
);

// =============================================================================
// Type exports
// =============================================================================

export type SharedFact = typeof sharedFacts.$inferSelect;
export type NewSharedFact = typeof sharedFacts.$inferInsert;
