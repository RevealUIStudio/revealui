/**
 * Waitlist Schema
 *
 * Stores email addresses for waitlist sign-ups with timestamps and metadata.
 */

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const waitlist = pgTable('waitlist', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  source: text('source'), // e.g., 'landing-page', 'blog', 'referral'
  referrer: text('referrer'), // HTTP referrer
  userAgent: text('user_agent'), // For analytics
  ipAddress: text('ip_address'), // For rate limiting and fraud detection
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  notifiedAt: timestamp('notified_at', { withTimezone: true }), // When they were notified about launch
});

export type WaitlistEntry = typeof waitlist.$inferSelect;
export type NewWaitlistEntry = typeof waitlist.$inferInsert;
