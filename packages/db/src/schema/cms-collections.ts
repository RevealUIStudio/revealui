/**
 * CMS collections that lived as admin configs without Postgres tables
 * (WIRE-UP-PENDING). Table name === collection slug so the registry
 * backing-storage guard and sqlAdapter agree.
 */

import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug'),
    slugLock: boolean('slug_lock').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [index('categories_slug_idx').on(table.slug)],
);

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  title: text('title'),
  name: text('name'),
  description: text('description'),
  image: text('image'),
  alt: text('alt'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .$onUpdateFn(() => new Date())
    .defaultNow()
    .notNull(),
});

export const contents = pgTable('contents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  image: text('image'),
  blocks: jsonb('blocks').$type<unknown[]>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .$onUpdateFn(() => new Date())
    .defaultNow()
    .notNull(),
});

export const tags = pgTable(
  'tags',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
  },
  (table) => [index('tags_slug_idx').on(table.slug)],
);

export const prices = pgTable(
  'prices',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug'),
    publishedOn: timestamp('published_on', { withTimezone: true }),
    stripePriceId: text('stripe_price_id'),
    priceJson: jsonb('price_json'),
    enablePaywall: boolean('enable_paywall').default(false),
    layout: jsonb('layout').$type<unknown[]>().default([]),
    paywall: jsonb('paywall').$type<unknown[]>().default([]),
    categories: jsonb('categories').$type<string[]>().default([]),
    relatedPrices: jsonb('related_prices').$type<string[]>().default([]),
    skipSync: boolean('skip_sync').default(false),
    status: text('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('prices_slug_idx').on(table.slug),
    index('prices_deleted_at_idx').on(table.deletedAt),
  ],
);

export const info = pgTable('info', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull(),
  description: text('description').notNull(),
  image: text('image').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .$onUpdateFn(() => new Date())
    .defaultNow()
    .notNull(),
});

export const videos = pgTable('videos', {
  id: text('id').primaryKey(),
  url: text('url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .$onUpdateFn(() => new Date())
    .defaultNow()
    .notNull(),
});

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    status: text('status').notNull(),
    priceId: text('price_id').notNull(),
    quantity: integer('quantity'),
    cancelAt: timestamp('cancel_at', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    trialStart: timestamp('trial_start', { withTimezone: true }),
    trialEnd: timestamp('trial_end', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [index('subscriptions_user_id_idx').on(table.userId)],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type EventRow = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type ContentRow = typeof contents.$inferSelect;
export type NewContent = typeof contents.$inferInsert;
export type TagRow = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type PriceRow = typeof prices.$inferSelect;
export type NewPrice = typeof prices.$inferInsert;
export type InfoRow = typeof info.$inferSelect;
export type NewInfo = typeof info.$inferInsert;
export type VideoRow = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
