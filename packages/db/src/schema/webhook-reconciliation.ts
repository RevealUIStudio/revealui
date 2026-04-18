/**
 * Unreconciled Webhooks
 *
 * Records webhook events where processing failed AND the idempotency
 * marker could not be cleaned up. Without this table, those events
 * become silent drops — Stripe retries hit the stale idempotency row,
 * returns 200 (duplicate), and the customer's payment is never fulfilled.
 *
 * A nightly cron reads this table and alerts. Manual reconciliation
 * resolves each row by re-processing or refunding.
 */

import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const unreconciledWebhooks = pgTable(
  'unreconciled_webhooks',
  {
    /** Stripe event ID (unique — one reconciliation record per event) */
    eventId: text('event_id').primaryKey(),
    /** Stripe event type (e.g. checkout.session.completed) */
    eventType: text('event_type').notNull(),
    /** Stripe customer ID (for lookup and alerting) */
    customerId: text('customer_id'),
    /** Stripe object ID (subscription, invoice, etc.) */
    stripeObjectId: text('stripe_object_id'),
    /** Type of Stripe object (subscription, invoice, charge, etc.) */
    objectType: text('object_type'),
    /** Error message from the failed processing attempt */
    errorTrace: text('error_trace').notNull(),
    /** When the failed event was recorded */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    /** When manual reconciliation was completed (null = unresolved) */
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    /** Who resolved it (agent ID, admin email, or 'cron') */
    resolvedBy: text('resolved_by'),
  },
  (table) => [
    index('unreconciled_webhooks_customer_id_idx').on(table.customerId),
    index('unreconciled_webhooks_created_at_idx').on(table.createdAt),
  ],
);
