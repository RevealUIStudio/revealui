/**
 * RevealUI-native Studio CRM persistence primitives.
 *
 * CRM contacts are external people, NOT authenticated RevealUI users.
 * Every CRM record is account-scoped; authorization is enforced by service/API.
 * Schema definitions alone must never be treated as an authorization boundary.
 */
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { accounts } from './accounts.js'
import { users } from './users.js'

export const crmOrganizations = pgTable('crm_organizations', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  website: text('website'),
  industry: text('industry'),
  location: text('location'),
  sourceUrl: text('source_url'),
  sourceVerifiedAt: timestamp('source_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
}, (t) => [index('crm_org_account_idx').on(t.accountId), index('crm_org_name_idx').on(t.accountId, t.name)])

export const crmContacts = pgTable('crm_contacts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').references(() => crmOrganizations.id, { onDelete: 'set null' }),
  name: text('name'),
  role: text('role'),
  businessEmail: text('business_email'),
  contactSourceUrl: text('contact_source_url'),
  doNotContact: integer('do_not_contact').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
}, (t) => [index('crm_contacts_account_idx').on(t.accountId), index('crm_contacts_org_idx').on(t.organizationId)])

export const crmOpportunities = pgTable('crm_opportunities', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull().references(() => crmOrganizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  stage: text('stage').notNull().default('research'),
  valueCents: integer('value_cents'),
  currency: text('currency').notNull().default('USD'),
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
  nextActionAt: timestamp('next_action_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
}, (t) => [index('crm_opps_account_stage_idx').on(t.accountId, t.stage), index('crm_opps_org_idx').on(t.organizationId)])

export const crmActivities = pgTable('crm_activities', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  opportunityId: text('opportunity_id').notNull().references(() => crmOpportunities.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  summary: text('summary').notNull(),
  actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('crm_activity_account_idx').on(t.accountId), index('crm_activity_opportunity_idx').on(t.opportunityId)])

export const crmCampaigns = pgTable('crm_campaigns', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('crm_campaigns_account_idx').on(t.accountId)])
