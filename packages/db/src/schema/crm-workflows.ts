import { foreignKey, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { accounts } from './accounts.js'
import { users } from './users.js'
import { crmCampaigns, crmContacts, crmOpportunities } from './crm.js'

/** CRM follow-up tasks, separate from engineering tickets until adapter is verified. */
export const crmTasks = pgTable('crm_tasks', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  opportunityId: text('opportunity_id'),
  title: text('title').notNull(),
  status: text('status').notNull().default('todo'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('crm_tasks_account_due_idx').on(t.accountId, t.dueAt),
  foreignKey({ columns: [t.accountId, t.opportunityId], foreignColumns: [crmOpportunities.accountId, crmOpportunities.id] }),
])

/** Drafts cannot be sent without separate reviewed transport and suppression checks. */
export const crmOutreachDrafts = pgTable('crm_outreach_drafts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  contactId: text('contact_id'),
  campaignId: text('campaign_id'),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('draft'),
  approvedBy: text('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('crm_outreach_account_status_idx').on(t.accountId, t.status),
  foreignKey({ columns: [t.accountId, t.contactId], foreignColumns: [crmContacts.accountId, crmContacts.id] }),
  foreignKey({ columns: [t.accountId, t.campaignId], foreignColumns: [crmCampaigns.accountId, crmCampaigns.id] }),
])

export const crmSuppression = pgTable('crm_suppression', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  normalizedEmail: text('normalized_email').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('crm_suppression_account_email_unique').on(t.accountId, t.normalizedEmail)])

export const crmStageHistory = pgTable('crm_stage_history', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  opportunityId: text('opportunity_id').notNull(),
  fromStage: text('from_stage'),
  toStage: text('to_stage').notNull(),
  changedBy: text('changed_by').references(() => users.id, { onDelete: 'set null' }),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('crm_stage_history_account_idx').on(t.accountId, t.changedAt),
  foreignKey({ columns: [t.accountId, t.opportunityId], foreignColumns: [crmOpportunities.accountId, crmOpportunities.id] }),
])
