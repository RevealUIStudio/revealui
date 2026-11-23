import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';
import { crmCampaigns, crmContacts, crmOpportunities } from './crm.js';
import { users } from './users.js';

/** CRM follow-up tasks, separate from engineering tickets until adapter is verified. */
export const crmTasks = pgTable(
  'crm_tasks',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    opportunityId: text('opportunity_id'),
    title: text('title').notNull(),
    version: integer('version').notNull().default(1),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: text('status').notNull().default('todo'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('crm_task_status_check', sql`status IN ('todo','in_progress','done','cancelled')`),
    index('crm_tasks_account_due_idx').on(t.accountId, t.dueAt),
    foreignKey({
      columns: [t.accountId, t.opportunityId],
      foreignColumns: [crmOpportunities.accountId, crmOpportunities.id],
    }).onDelete('cascade'),
  ],
);

/** Drafts cannot be sent without separate reviewed transport and suppression checks. */
export const crmOutreachDrafts = pgTable(
  'crm_outreach_drafts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').notNull(),
    version: integer('version').notNull().default(1),
    evidence: jsonb('evidence').$type<string[]>().notNull().default([]),
    model: text('model'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    campaignId: text('campaign_id'),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull().default('draft'),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('crm_draft_status_check', sql`status IN ('draft','approved','cancelled')`),
    check(
      'crm_draft_approval_check',
      sql`status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)`,
    ),
    index('crm_outreach_account_status_idx').on(t.accountId, t.status),
    foreignKey({
      columns: [t.accountId, t.contactId],
      foreignColumns: [crmContacts.accountId, crmContacts.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.accountId, t.campaignId],
      foreignColumns: [crmCampaigns.accountId, crmCampaigns.id],
    }).onDelete('restrict'),
  ],
);

export const crmSuppression = pgTable(
  'crm_suppression',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    normalizedEmail: text('normalized_email').notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('crm_suppression_account_email_unique').on(t.accountId, t.normalizedEmail)],
);

export const crmStageHistory = pgTable(
  'crm_stage_history',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    opportunityId: text('opportunity_id').notNull(),
    fromStage: text('from_stage'),
    toStage: text('to_stage').notNull(),
    changedBy: text('changed_by').references(() => users.id, { onDelete: 'set null' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('crm_stage_history_account_idx').on(t.accountId, t.changedAt),
    foreignKey({
      columns: [t.accountId, t.opportunityId],
      foreignColumns: [crmOpportunities.accountId, crmOpportunities.id],
    }),
  ],
);

/** Enrollment is unique per contact/campaign; suppression is checked independently. */
export const crmEnrollments = pgTable(
  'crm_enrollments',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    campaignId: text('campaign_id').notNull(),
    contactId: text('contact_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('crm_enrollment_unique').on(t.accountId, t.campaignId, t.contactId),
    foreignKey({
      columns: [t.accountId, t.contactId],
      foreignColumns: [crmContacts.accountId, crmContacts.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.accountId, t.campaignId],
      foreignColumns: [crmCampaigns.accountId, crmCampaigns.id],
    }).onDelete('restrict'),
  ],
);

/** Durable import receipts contain counts and a digest, never raw prospect files. */
export const crmImports = pgTable(
  'crm_imports',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    idempotencyKey: text('idempotency_key').notNull(),
    digest: text('digest').notNull(),
    inserted: integer('inserted').notNull(),
    skipped: integer('skipped').notNull(),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('crm_import_idempotency_unique').on(t.accountId, t.idempotencyKey)],
);

/** CRM links existing canonical bookings; it does not own payment or fulfillment. */
export const crmBookingLinks = pgTable(
  'crm_booking_links',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    opportunityId: text('opportunity_id').notNull(),
    bookingId: text('booking_id').notNull(),
    siteId: text('site_id'),
    sourceSnapshot: jsonb('source_snapshot').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('crm_booking_link_unique').on(t.accountId, t.bookingId),
    foreignKey({
      columns: [t.accountId, t.opportunityId],
      foreignColumns: [crmOpportunities.accountId, crmOpportunities.id],
    }).onDelete('restrict'),
  ],
);

/** Append-only CRM mutation receipts, without confidential field contents. */
export const crmAuditEvents = pgTable(
  'crm_audit_events',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    resource: text('resource').notNull(),
    recordId: text('record_id').notNull(),
    action: text('action').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('crm_audit_account_time_idx').on(t.accountId, t.occurredAt)],
);
