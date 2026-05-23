/**
 * Processed Webhook Events Table
 *
 * Provides database-backed idempotency for Stripe webhook processing.
 * Prevents duplicate event handling across Vercel multi-region deployments
 * where in-memory deduplication would fail.
 */

import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const processedWebhookEvents = pgTable(
  'processed_webhook_events',
  {
    /** Stripe event ID (evt_...)  -  serves as primary key for idempotency */
    id: text('id').primaryKey(),

    /** Stripe event type (e.g. checkout.session.completed) */
    eventType: text('event_type').notNull(),

    /**
     * Processing state for the claim/complete idempotency protocol:
     * - 'processing': claimed, but side effects are not yet confirmed. A
     *   'processing' row older than the reclaim window means the prior attempt
     *   crashed mid-flight and the event may be reclaimed + retried.
     * - 'completed': side effects ran to completion; later deliveries are
     *   genuine duplicates and are skipped.
     *
     * Defaults to 'completed' so EXISTING rows (only ever written by the legacy
     * mark-first path) migrate as already-done dedup markers.
     */
    status: text('status').notNull().default('completed'),

    /** When the current attempt claimed the event (drives stale-reclaim). */
    claimedAt: timestamp('claimed_at', { withTimezone: true }).defaultNow().notNull(),

    /** When the event was marked completed. */
    processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('webhook_events_processed_at_idx').on(table.processedAt),
    index('webhook_events_status_claimed_idx').on(table.status, table.claimedAt),
  ],
);

export type ProcessedWebhookEventRow = typeof processedWebhookEvents.$inferSelect;
export type ProcessedWebhookEventInsert = typeof processedWebhookEvents.$inferInsert;
