/**
 * Studio leads — owned pipeline (not a vendor CRM, not a public SKU).
 *
 * Contact-form success inserts a row with source agency|marketing.
 * Status moves only in admin. Intros use the existing Google Calendar
 * Meet URL (INTRO_CALL_URL on the agency site) — no Calendar OAuth.
 */

import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const LEAD_STATUSES = [
  'lead',
  'intro_booked',
  'intro_done',
  'pilot',
  'launch',
  'closed',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ['agency', 'marketing', 'manual'] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const leads = pgTable(
  'leads',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    name: text('name').notNull(),
    email: text('email').notNull(),
    company: text('company'),
    source: text('source').notNull().default('manual'),
    status: text('status').notNull().default('lead'),
    notes: text('notes'),
    introAt: timestamp('intro_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('leads_status_idx').on(table.status),
    check(
      'leads_status_check',
      sql`status IN ('lead', 'intro_booked', 'intro_done', 'pilot', 'launch', 'closed')`,
    ),
    check('leads_source_check', sql`source IN ('agency', 'marketing', 'manual')`),
  ],
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
