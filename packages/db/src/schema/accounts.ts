/**
 * Account Entitlements Schema
 *
 * Additive SaaS billing model for hosted RevealUI:
 * - accounts are the billing owner
 * - memberships attach users to accounts
 * - subscriptions and entitlements attach to accounts
 * - usage meters record billable business activity
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('accounts_slug_idx').on(table.slug),
    index('accounts_status_idx').on(table.status),
    index('accounts_status_created_at_idx').on(table.status, table.createdAt),
  ],
);

export const accountMemberships = pgTable(
  'account_memberships',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('account_memberships_account_user_idx').on(table.accountId, table.userId),
    index('account_memberships_user_id_idx').on(table.userId),
    index('account_memberships_account_id_idx').on(table.accountId),
    index('account_memberships_status_idx').on(table.status),
  ],
);

export const accountSubscriptions = pgTable(
  'account_subscriptions',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id'),
    planId: text('plan_id').notNull(),
    status: text('status').notNull().default('active'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('account_subscriptions_stripe_subscription_idx').on(table.stripeSubscriptionId),
    index('account_subscriptions_account_id_idx').on(table.accountId),
    index('account_subscriptions_stripe_customer_idx').on(table.stripeCustomerId),
    index('account_subscriptions_status_idx').on(table.status),
    index('account_subscriptions_account_status_idx').on(table.accountId, table.status),
    check(
      'account_subscriptions_status_check',
      sql`status IN ('active', 'past_due', 'canceled', 'trialing', 'unpaid', 'expired', 'revoked', 'paused')`,
    ),
  ],
);

export const accountEntitlements = pgTable(
  'account_entitlements',
  {
    accountId: text('account_id')
      .primaryKey()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    planId: text('plan_id').notNull(),
    tier: text('tier').notNull().default('free'),
    status: text('status').notNull().default('active'),
    features: jsonb('features').$type<Record<string, boolean>>().notNull().default({}),
    limits: jsonb('limits')
      .$type<{
        maxSites?: number;
        maxUsers?: number;
        maxAgentTasks?: number;
      }>()
      .notNull()
      .default({}),
    meteringStatus: text('metering_status').notNull().default('active'),
    graceUntil: timestamp('grace_until', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('account_entitlements_tier_idx').on(table.tier),
    index('account_entitlements_status_idx').on(table.status),
    index('account_entitlements_account_status_idx').on(table.accountId, table.status),
    check('account_entitlements_tier_check', sql`tier IN ('free', 'pro', 'max', 'enterprise')`),
    check(
      'account_entitlements_status_check',
      sql`status IN ('active', 'past_due', 'canceled', 'expired', 'revoked')`,
    ),
  ],
);

export const billingCatalog = pgTable(
  'billing_catalog',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id').notNull(),
    tier: text('tier').notNull(),
    billingModel: text('billing_model').notNull(),
    stripeProductId: text('stripe_product_id'),
    stripePriceId: text('stripe_price_id'),
    active: boolean('active').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('billing_catalog_plan_id_idx').on(table.planId),
    index('billing_catalog_tier_idx').on(table.tier),
    index('billing_catalog_billing_model_idx').on(table.billingModel),
    index('billing_catalog_active_idx').on(table.active),
    check('billing_catalog_tier_check', sql`tier IN ('free', 'pro', 'max', 'enterprise')`),
    check(
      'billing_catalog_billing_model_check',
      sql`billing_model IN ('subscription', 'perpetual', 'renewal', 'credits')`,
    ),
  ],
);

export const usageMeters = pgTable(
  'usage_meters',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    meterName: text('meter_name').notNull(),
    quantity: bigint('quantity', { mode: 'number' }).notNull().default(1),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    source: text('source').notNull().default('system'),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('usage_meters_idempotency_key_idx').on(table.idempotencyKey),
    index('usage_meters_account_id_idx').on(table.accountId),
    index('usage_meters_meter_name_idx').on(table.meterName),
    index('usage_meters_period_start_idx').on(table.periodStart),
    index('usage_meters_account_period_idx').on(table.accountId, table.periodStart),
  ],
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type AccountMembership = typeof accountMemberships.$inferSelect;
export type NewAccountMembership = typeof accountMemberships.$inferInsert;
export type AccountSubscription = typeof accountSubscriptions.$inferSelect;
export type NewAccountSubscription = typeof accountSubscriptions.$inferInsert;
export type AccountEntitlement = typeof accountEntitlements.$inferSelect;
export type NewAccountEntitlement = typeof accountEntitlements.$inferInsert;
export type BillingCatalogEntry = typeof billingCatalog.$inferSelect;
export type NewBillingCatalogEntry = typeof billingCatalog.$inferInsert;
export type UsageMeter = typeof usageMeters.$inferSelect;
export type NewUsageMeter = typeof usageMeters.$inferInsert;
