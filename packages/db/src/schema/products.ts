/**
 * Product and Order tables
 *
 * Products are standalone content items (Stripe-backed).
 * Orders track purchases with status, line items, and customer info.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

// =============================================================================
// Product Statuses
// =============================================================================

export const PRODUCT_STATUSES = ['draft', 'published', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

// =============================================================================
// Products Table
// =============================================================================

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),

    /** Product title */
    title: text('title').notNull(),

    /** URL-friendly slug */
    slug: text('slug').notNull().unique(),

    /** Short description */
    description: text('description'),

    /** Price in cents */
    priceInCents: integer('price_in_cents'),

    /** ISO 4217 currency code */
    currency: text('currency').notNull().default('usd'),

    /** Stripe Product ID (prod_xxx) */
    stripeProductId: text('stripe_product_id'),

    /** Stripe Price ID (price_xxx) */
    stripePriceId: text('stripe_price_id'),

    /** Whether the product is currently available for purchase */
    active: boolean('active').notNull().default(true),

    /** Publication status */
    status: text('status').notNull().default('draft'),

    /** Product images as JSON array of URLs */
    images: jsonb('images').$type<string[]>().default([]),

    /** Arbitrary metadata */
    metadata: jsonb('metadata'),

    /** Owner / creator */
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('products_owner_id_idx').on(table.ownerId),
    index('products_status_idx').on(table.status),
    index('products_deleted_at_idx').on(table.deletedAt),
    index('products_slug_idx').on(table.slug),
    check('products_status_check', sql`status IN ('draft', 'published', 'archived')`),
  ],
);

// =============================================================================
// Order Statuses
// =============================================================================

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// =============================================================================
// Orders Table
// =============================================================================

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),

    /** Customer who placed the order */
    customerId: text('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Current order status */
    status: text('status').notNull().default('pending'),

    /** Total amount in cents */
    totalInCents: integer('total_in_cents').notNull().default(0),

    /** ISO 4217 currency code */
    currency: text('currency').notNull().default('usd'),

    /** Stripe Payment Intent ID */
    stripePaymentIntentId: text('stripe_payment_intent_id'),

    /** Stripe Checkout Session ID */
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),

    /**
     * Line items as JSON array:
     * [{ productId, title, quantity, priceInCents }]
     */
    items: jsonb('items')
      .$type<
        Array<{
          productId: string;
          title: string;
          quantity: number;
          priceInCents: number;
        }>
      >()
      .notNull()
      .default([]),

    /** Shipping / billing address (optional) */
    shippingAddress: jsonb('shipping_address'),

    /** Arbitrary metadata */
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),

    /** Soft-delete — financial records must never be hard-deleted */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('orders_customer_id_idx').on(table.customerId),
    index('orders_status_idx').on(table.status),
    index('orders_created_at_idx').on(table.createdAt),
    index('orders_deleted_at_idx').on(table.deletedAt),
    check(
      'orders_status_check',
      sql`status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')`,
    ),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
