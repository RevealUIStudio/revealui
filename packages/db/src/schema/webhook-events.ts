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

    /** When the event was processed */
    processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('webhook_events_processed_at_idx').on(table.processedAt)],
);

export type ProcessedWebhookEventRow = typeof processedWebhookEvents.$inferSelect;
export type ProcessedWebhookEventInsert = typeof processedWebhookEvents.$inferInsert;
