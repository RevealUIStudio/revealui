import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Enums
export const pricingType = pgEnum('pricing_type', ['one_time', 'recurring']);
export const pricingPlanInterval = pgEnum('pricing_plan_interval', [
  'day',
  'week',
  'month',
  'year',
]);
export const subscriptionStatus = pgEnum('subscription_status', [
  'trialing',
  'active',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'unpaid',
]);

// Users table
export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  billingAddress: jsonb('billing_address'),
  paymentMethod: jsonb('payment_method'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Auth users reference (for foreign keys)
export const authUsers = pgTable('auth.users', {
  id: uuid('id').primaryKey(),
});

// Customers table
export const customers = pgTable('customers', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id),
  stripeCustomerId: text('stripe_customer_id'),
});

// Products table
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  active: boolean('active').default(true),
  name: text('name'),
  description: text('description'),
  image: text('image'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Prices table
export const prices = pgTable('prices', {
  id: text('id').primaryKey(),
  productId: text('product_id').references(() => products.id),
  active: boolean('active').default(true),
  description: text('description'),
  unitAmount: bigint('unit_amount', { mode: 'number' }),
  currency: text('currency'),
  type: pricingType('type'),
  interval: pricingPlanInterval('interval'),
  intervalCount: bigint('interval_count', { mode: 'number' }),
  trialPeriodDays: bigint('trial_period_days', { mode: 'number' }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Subscriptions table
export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id),
  status: subscriptionStatus('status'),
  metadata: jsonb('metadata'),
  priceId: text('price_id').references(() => prices.id),
  quantity: bigint('quantity', { mode: 'number' }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  created: timestamp('created', { withTimezone: true }).defaultNow(),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).defaultNow(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  cancelAt: timestamp('cancel_at', { withTimezone: true }),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  trialStart: timestamp('trial_start', { withTimezone: true }),
  trialEnd: timestamp('trial_end', { withTimezone: true }),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const productsRelations = relations(products, ({ many }) => ({
  prices: many(prices),
}));

export const pricesRelations = relations(prices, ({ one, many }) => ({
  product: one(products, {
    fields: [prices.productId],
    references: [products.id],
  }),
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(authUsers, {
    fields: [subscriptions.userId],
    references: [authUsers.id],
  }),
  price: one(prices, {
    fields: [subscriptions.priceId],
    references: [prices.id],
  }),
}));
