/**
 * Lifecycle Emails Ledger
 *
 * Records each onboarding lifecycle email decision (day-0 welcome, day-1
 * check-in, day-7 outcome) so the daily cron fires each (user, email-type)
 * exactly once.
 *
 * Idempotency reuses the `usage_meters.idempotency_key` pattern: a unique
 * `idempotency_key` column plus an `insert().onConflictDoNothing()` claim.
 * The key embeds the send MODE (`sent` when the transport actually ran,
 * `dry_run` when the sequence is disarmed) so a disarmed dry-run row never
 * consumes the real-send slot. When sending is later armed, the `sent:` key
 * is still unclaimed and the real email goes out once.
 */

import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const lifecycleEmailsSent = pgTable(
  'lifecycle_emails_sent',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    /** Deterministic claim key: `lifecycle:<mode>:<emailType>:<userId>`. */
    idempotencyKey: text('idempotency_key').notNull(),

    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** 'day0_welcome' | 'day1_checkin' | 'day7_outcome'. */
    emailType: text('email_type').notNull(),

    /** Tier snapshot at decision time: 'free' | 'pro' | 'max' | 'enterprise'. */
    tier: text('tier').notNull().default('free'),

    /** 'sent' when the transport ran; 'dry_run' when the sequence was disarmed. */
    status: text('status').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('lifecycle_emails_sent_idempotency_key_idx').on(table.idempotencyKey),
    index('lifecycle_emails_sent_user_id_idx').on(table.userId),
    check(
      'lifecycle_emails_sent_email_type_check',
      sql`email_type IN ('day0_welcome', 'day1_checkin', 'day7_outcome')`,
    ),
    check('lifecycle_emails_sent_status_check', sql`status IN ('sent', 'dry_run')`),
    check('lifecycle_emails_sent_tier_check', sql`tier IN ('free', 'pro', 'max', 'enterprise')`),
  ],
);

export type LifecycleEmailSent = typeof lifecycleEmailsSent.$inferSelect;
export type NewLifecycleEmailSent = typeof lifecycleEmailsSent.$inferInsert;
