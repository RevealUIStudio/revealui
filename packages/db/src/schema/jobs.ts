/**
 * Background Jobs Table
 *
 * PostgreSQL-backed job queue for async task processing.
 * Used for: email delivery, webhook processing, RAG indexing, billing crons.
 * No external dependencies (no Redis, no pg-boss)  -  pure Drizzle ORM.
 */

import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// =============================================================================
// Jobs Table
// =============================================================================

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(),

    /** Job type identifier (e.g., 'email.send', 'webhook.process', 'rag.index') */
    name: text('name').notNull(),

    /** Job payload (JSON) */
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),

    /**
     * Job state machine:
     * - created: waiting to be picked up
     * - active: currently being processed
     * - completed: finished successfully
     * - failed: failed after all retries exhausted
     * - retry: waiting for next retry attempt
     */
    state: text('state').notNull().default('created'),

    /** Priority: higher = processed first (default: 0) */
    priority: integer('priority').notNull().default(0),

    /** Number of retry attempts made */
    retryCount: integer('retry_count').notNull().default(0),

    /** Maximum retry attempts allowed */
    retryLimit: integer('retry_limit').notNull().default(3),

    /** Earliest time this job should be processed (for delayed/scheduled jobs) */
    startAfter: timestamp('start_after', { withTimezone: true }).defaultNow().notNull(),

    /** When this job should expire if not completed */
    expireAt: timestamp('expire_at', { withTimezone: true }),

    /** Last error message (set on failure) */
    output: jsonb('output').$type<Record<string, unknown>>(),

    /** Timestamps */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('jobs_state_start_after_idx').on(table.state, table.startAfter),
    index('jobs_name_idx').on(table.name),
    index('jobs_state_idx').on(table.state),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
