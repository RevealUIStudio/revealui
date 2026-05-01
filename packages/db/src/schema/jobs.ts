/**
 * Background Jobs Table
 *
 * PostgreSQL-backed job queue for async task processing.
 * Used for: email delivery, webhook processing, RAG indexing, billing crons,
 * saga outbox, and the durable work queue primitive (CR8-P2-01).
 * No external dependencies (no Redis, no pg-boss)  -  pure Drizzle ORM.
 *
 * Visibility-timeout semantics (CR8-P2-01):
 * - `locked_by`    — worker identity (per-invocation UUID) holding the claim
 * - `locked_until` — timestamp at which an abandoned claim becomes reclaimable
 * - `last_error`   — latest failure message for DLQ inspection without digging
 *                    into the output JSONB
 *
 * See packages/db/src/jobs/ for the producer + claim primitives and
 * apps/server/src/routes/jobs/run.ts for the worker route.
 */

import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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
     * - created:   waiting to be picked up (includes retries — a retry is a
     *              created row with start_after in the future and
     *              retry_count > 0)
     * - active:    currently being processed (lock held via locked_by /
     *              locked_until)
     * - completed: finished successfully
     * - failed:    failed after all retries exhausted (DLQ)
     * - retry:     legacy — no new writes use this state; the CHECK constraint
     *              permits it so existing rows remain valid. Retrying jobs are
     *              written back as 'created' with updated start_after.
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

    /** Output of the last run attempt (result or failure metadata) */
    output: jsonb('output').$type<Record<string, unknown>>(),

    /**
     * Worker identity that holds the current claim. NULL when the row is not
     * claimed. Set by the worker on a successful SKIP LOCKED dequeue; cleared
     * on markCompleted / markFailedOrRetry.
     */
    lockedBy: text('locked_by'),

    /**
     * Visibility timeout: the claim is valid until this timestamp. The cron
     * safety-net (phase B) reclaims rows where state = 'active' AND
     * locked_until < now(). Cleared on claim release.
     */
    lockedUntil: timestamp('locked_until', { withTimezone: true }),

    /** Most recent failure message. Surfaced in DLQ views / admin dashboard. */
    lastError: text('last_error'),

    /** Timestamps */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('jobs_state_start_after_idx').on(table.state, table.startAfter),
    index('jobs_name_idx').on(table.name),
    index('jobs_state_idx').on(table.state),
    // Partial index: supports the cron safety-net's stall-reclaim query
    // without bloating index size (most rows are not in 'active' state).
    index('jobs_locked_until_idx').on(table.lockedUntil).where(sql`state = 'active'`),
    check('jobs_state_check', sql`state IN ('created', 'active', 'completed', 'failed', 'retry')`),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
