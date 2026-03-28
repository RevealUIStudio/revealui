/**
 * Price Schema
 *
 * Prices represent Stripe-backed pricing information for products.
 * They support various pricing models (one-time, recurring, tiered) and
 * integrate with RevealUI's content management for pricing pages.
 *
 * This schema provides:
 * - Stripe price validation (price_xxx format)
 * - JSON price data validation
 * - Business rules (published prices require valid Stripe data)
 * - Type-safe relationship handling
 * - Runtime validation with Zod
 */

import { z } from 'zod/v4';
import { createContract } from '../foundation/contract.js';
import { DualEntitySchema } from '../representation/index.js';

// =============================================================================
// Schema Version
// =============================================================================

export const PRICE_SCHEMA_VERSION = 1;

// =============================================================================
// Stripe Price Format
// =============================================================================

/**
 * Stripe Price ID format: price_xxxxx
 * @example "price_1MowQVLkdIwHu7ixraBm864M"
 */
export const StripePriceIDSchema = z
  .string()
  .regex(/^price_[a-zA-Z0-9]+$/, {
    message: 'Stripe Price ID must match format: price_xxxxx',
  })
  .min(14) // price_ + minimum ID length
  .max(100);

export type StripePriceID = z.infer<typeof StripePriceIDSchema>;

// =============================================================================
// Stripe Price Data
// =============================================================================

/**
 * Stripe Price object structure (subset of fields from Stripe API)
 * Stored as JSON in priceJSON field
 */
export const StripePriceDataSchema = z.object({
  id: z.string(),
  object: z.literal('price'),
  active: z.boolean().optional(),
  currency: z.string().length(3).toLowerCase(), // ISO 4217 currency code
  unit_amount: z.number().int().nonnegative().nullable(), // Amount in cents
  unit_amount_decimal: z.string().optional(),
  type: z.enum(['one_time', 'recurring']).optional(),
  recurring: z
    .object({
      interval: z.enum(['day', 'week', 'month', 'year']),
      interval_count: z.number().int().positive(),
      trial_period_days: z.number().int().nonnegative().optional(),
    })
    .optional(),
  product: z.string().optional(), // Stripe product ID
  metadata: z.record(z.string(), z.string()).optional(),
  // Tiers for tiered pricing
  tiers: z
    .array(
      z.object({
        flat_amount: z.number().int().nonnegative().nullable().optional(),
        flat_amount_decimal: z.string().optional(),
        unit_amount: z.number().int().nonnegative().nullable().optional(),
        unit_amount_decimal: z.string().optional(),
        up_to: z.union([z.number().int().positive(), z.literal('inf')]).optional(),
      }),
    )
    .optional(),
});

export type StripePriceData = z.infer<typeof StripePriceDataSchema>;

// =============================================================================
// Price Status
// =============================================================================

export const PriceStatusSchema = z.enum(['draft', 'published']);
export type PriceStatus = z.infer<typeof PriceStatusSchema>;

// =============================================================================
// Content Blocks (simplified for now)
// =============================================================================

/**
 * Simplified block schema for price content
 * In production, this would reference the full block schema
 */
const PriceBlockSchema = z.object({
  blockType: z.string(),
  blockName: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// Price Base Schema (without circular reference)
// =============================================================================

// Base object schema without refinements (for extending)
const PriceObjectSchema = DualEntitySchema.extend({
  /** Schema version for migrations */
  schemaVersion: z.number().int().default(PRICE_SCHEMA_VERSION),

  /** Numeric ID (from CMS) */
  id: z.number().int().positive(),

  /** Price title for admin display */
  title: z.string().min(1).max(200),

  /** Published date */
  publishedOn: z.string().datetime().nullable().optional(),

  /** Content layout blocks */
  layout: z.array(PriceBlockSchema).nullable().optional(),

  /** Stripe Price ID (validated format) */
  stripePriceID: StripePriceIDSchema.nullable().optional(),

  /** Stripe price data (JSON string) */
  priceJSON: z
    .string()
    .nullable()
    .optional()
    .transform((val) => {
      if (!val) return null;
      try {
        return JSON.parse(val) as unknown;
      } catch {
        return null;
      }
    })
    .pipe(StripePriceDataSchema.nullable()),

  /** Enable paywall for this price */
  enablePaywall: z.boolean().nullable().optional(),

  /** Paywall content blocks */
  paywall: z.array(PriceBlockSchema).nullable().optional(),

  /** Categories (populated or IDs) */
  categories: z
    .array(z.union([z.number().int().positive(), z.object({ id: z.number() }).passthrough()]))
    .nullable()
    .optional(),

  /** Related prices (populated or IDs) */
  relatedPrices: z
    .array(z.union([z.number().int().positive(), z.object({ id: z.number() }).passthrough()]))
    .nullable()
    .optional(),

  /** Skip Stripe sync flag */
  skipSync: z.boolean().nullable().optional(),

  /** Timestamps */
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),

  /** CMS status */
  _status: PriceStatusSchema.nullable().optional(),
});

// Full schema with business rule refinements
const PriceBaseSchema = PriceObjectSchema.refine(
  (data) => {
    // Business rule: published prices must have a valid Stripe price
    if (data._status === 'published') {
      return !!data.stripePriceID;
    }
    return true;
  },
  {
    message: 'Published prices must have a valid Stripe Price ID',
    path: ['stripePriceID'],
  },
).refine(
  (data) => {
    // Business rule: if priceJSON exists, it should be valid
    if (data.priceJSON && typeof data.priceJSON === 'object') {
      return data.priceJSON.id === data.stripePriceID;
    }
    return true;
  },
  {
    message: 'Price JSON must match the configured Stripe Price ID',
    path: ['priceJSON'],
  },
);

export type Price = z.infer<typeof PriceBaseSchema>;

/** Main schema export (alias for PriceBaseSchema) */
export const PriceSchema = PriceBaseSchema;

// =============================================================================
// Create Price Input
// =============================================================================

export const CreatePriceInputSchema = z.object({
  title: z.string().min(1).max(200),
  stripePriceID: StripePriceIDSchema.optional(),
  enablePaywall: z.boolean().optional(),
  categories: z.array(z.number().int().positive()).optional(),
  relatedPrices: z.array(z.number().int().positive()).optional(),
  _status: PriceStatusSchema.optional(),
});

export type CreatePriceInput = z.infer<typeof CreatePriceInputSchema>;

// =============================================================================
// Update Price Input
// =============================================================================

export const UpdatePriceInputSchema = CreatePriceInputSchema.partial();

export type UpdatePriceInput = z.infer<typeof UpdatePriceInputSchema>;

// =============================================================================
// Price with Populated Relationships
// =============================================================================

/**
 * Price with categories populated
 */
export const PriceWithCategoriesSchema = PriceObjectSchema.extend({
  categories: z.array(z.object({ id: z.number(), name: z.string() }).passthrough()).nullable(),
});

export type PriceWithCategories = z.infer<typeof PriceWithCategoriesSchema>;

/**
 * Price with all relationships populated
 */
export const PriceWithRelatedSchema = PriceObjectSchema.extend({
  categories: z.array(z.object({ id: z.number(), name: z.string() }).passthrough()).nullable(),
  relatedPrices: z
    .array(
      z.object({
        id: z.number(),
        title: z.string(),
        stripePriceID: z.string().nullable(),
      }),
    )
    .nullable(),
});

export type PriceWithRelated = z.infer<typeof PriceWithRelatedSchema>;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if price has a valid Stripe price configured
 */
export function hasStripePrice(price: Price): price is Price & {
  stripePriceID: string;
  priceJSON: StripePriceData;
} {
  return !!price.stripePriceID && !!price.priceJSON && price.priceJSON !== null;
}

/**
 * Check if price is published and active
 */
export function isPublishedPrice(price: Price): boolean {
  return price._status === 'published' && hasStripePrice(price);
}

/**
 * Check if price is recurring (subscription)
 */
export function isRecurringPrice(price: Price): boolean {
  if (!hasStripePrice(price)) return false;
  return price.priceJSON.type === 'recurring';
}

/**
 * Check if price is one-time payment
 */
export function isOneTimePrice(price: Price): boolean {
  if (!hasStripePrice(price)) return false;
  return price.priceJSON.type === 'one_time';
}

/**
 * Check if price has tiered pricing
 */
export function hasTieredPricing(price: Price): boolean {
  if (!hasStripePrice(price)) return false;
  return !!price.priceJSON.tiers && price.priceJSON.tiers.length > 0;
}

// =============================================================================
// Price Formatting Utilities
// =============================================================================

/**
 * Format price amount for display
 * @param amount - Amount in cents
 * @param currency - ISO 4217 currency code
 * @returns Formatted price string (e.g., "$10.00")
 */
export function formatPriceAmount(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(amount / 100);
}

/**
 * Get display amount from price
 */
export function getDisplayAmount(price: Price): string | null {
  if (!hasStripePrice(price)) return null;

  const amount = price.priceJSON.unit_amount;
  if (amount === null || amount === undefined) return null;

  return formatPriceAmount(amount, price.priceJSON.currency);
}

/**
 * Get interval description for recurring prices
 * @example "monthly", "yearly", "every 3 months"
 */
export function getIntervalDescription(price: Price): string | null {
  if (!(isRecurringPrice(price) && price.priceJSON)) return null;

  const recurring = price.priceJSON.recurring;
  if (!recurring) return null;

  const { interval, interval_count } = recurring;

  if (interval_count === 1) {
    return `${interval}ly`;
  }

  return `every ${interval_count} ${interval}s`;
}

// =============================================================================
// Contracts
// =============================================================================

export const PriceContract = createContract({
  name: 'Price',
  version: '1',
  schema: PriceSchema,
  description: 'Stripe-backed price entity with content management',
});

export const CreatePriceContract = createContract({
  name: 'CreatePrice',
  version: '1',
  schema: CreatePriceInputSchema,
  description: 'Input contract for creating a new price',
});

export const UpdatePriceContract = createContract({
  name: 'UpdatePrice',
  version: '1',
  schema: UpdatePriceInputSchema,
  description: 'Input contract for updating an existing price',
});
