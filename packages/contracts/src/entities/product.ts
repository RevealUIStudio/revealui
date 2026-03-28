/**
 * Product Schema
 *
 * Products represent Stripe-backed product information with associated pricing.
 * They support content management and integrate with RevealUI's CMS.
 *
 * This schema provides:
 * - Stripe product validation (prod_xxx format)
 * - Stripe product data structure validation
 * - Business rules (published products require valid Stripe data)
 * - Type-safe relationship handling
 * - Runtime validation with Zod
 */

import { z } from 'zod/v4';
import { createContract } from '../foundation/contract.js';
import { DualEntitySchema } from '../representation/index.js';

// =============================================================================
// Schema Version
// =============================================================================

export const PRODUCT_SCHEMA_VERSION = 1;

// =============================================================================
// Stripe Product Format
// =============================================================================

/**
 * Stripe Product ID format: prod_xxxxx
 * @example "prod_MowQVLkdIwHu7ixraBm864M"
 */
export const StripeProductIDSchema = z
  .string()
  .regex(/^prod_[a-zA-Z0-9]+$/, {
    message: 'Stripe Product ID must match format: prod_xxxxx',
  })
  .min(14) // prod_ + minimum ID length
  .max(100);

export type StripeProductID = z.infer<typeof StripeProductIDSchema>;

// =============================================================================
// Stripe Product Data
// =============================================================================

/**
 * Stripe Product object structure (subset of fields from Stripe API)
 * Stored as JSON in product metadata
 */
export const StripeProductDataSchema = z.object({
  id: z.string(),
  object: z.literal('product'),
  active: z.boolean(),
  name: z.string(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  images: z.array(z.string()).optional(),
  features: z.array(z.object({ name: z.string() })).optional(),
  default_price: z.string().nullable().optional(), // Default price ID
  shippable: z.boolean().optional(),
  url: z.string().nullable().optional(),
});

export type StripeProductData = z.infer<typeof StripeProductDataSchema>;

/**
 * Stripe Price List (stored in priceJSON)
 */
export const StripePriceListSchema = z.object({
  object: z.literal('list'),
  data: z.array(
    z.object({
      id: z.string(),
      object: z.literal('price'),
      active: z.boolean().optional(),
      currency: z.string().length(3),
      unit_amount: z.number().int().nonnegative().nullable().optional(),
      type: z.enum(['one_time', 'recurring']).optional(),
      recurring: z
        .object({
          interval: z.enum(['day', 'week', 'month', 'year']),
          interval_count: z.number().int().positive(),
        })
        .optional(),
    }),
  ),
  has_more: z.boolean(),
});

export type StripePriceList = z.infer<typeof StripePriceListSchema>;

// =============================================================================
// Product Status
// =============================================================================

export const ProductStatusSchema = z.enum(['draft', 'published']);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

// =============================================================================
// Content Blocks
// =============================================================================

const ProductBlockSchema = z.object({
  blockType: z.string(),
  blockName: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// Product Base Schema
// =============================================================================

// Base object schema without refinements (for extending)
const ProductObjectSchema = DualEntitySchema.extend({
  /** Schema version for migrations */
  schemaVersion: z.number().int().default(PRODUCT_SCHEMA_VERSION),

  /** Numeric ID (from CMS) */
  id: z.number().int().positive(),

  /** Product title */
  title: z.string().min(1).max(200),

  /** Published date */
  publishedOn: z.string().datetime().nullable().optional(),

  /** Content layout blocks */
  layout: z.array(ProductBlockSchema).nullable().optional(),

  /** Stripe Product ID (validated format) */
  stripeProductID: StripeProductIDSchema.nullable().optional(),

  /** Stripe price list (JSON string) */
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
    .pipe(StripePriceListSchema.nullable()),

  /** Enable paywall */
  enablePaywall: z.boolean().nullable().optional(),

  /** Paywall content blocks */
  paywall: z.array(ProductBlockSchema).nullable().optional(),

  /** Categories (populated or IDs) */
  categories: z
    .array(z.union([z.number().int().positive(), z.object({ id: z.number() }).passthrough()]))
    .nullable()
    .optional(),

  /** Related products (populated or IDs) */
  relatedProducts: z
    .array(z.union([z.number().int().positive(), z.object({ id: z.number() }).passthrough()]))
    .nullable()
    .optional(),

  /** Skip Stripe sync flag */
  skipSync: z.boolean().nullable().optional(),

  /** Timestamps */
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),

  /** CMS status */
  _status: ProductStatusSchema.nullable().optional(),
});

// Full schema with business rule refinements
const ProductBaseSchema = ProductObjectSchema.refine(
  (data) => {
    // Business rule: published products must have a valid Stripe product
    if (data._status === 'published') {
      return !!data.stripeProductID;
    }
    return true;
  },
  {
    message: 'Published products must have a valid Stripe Product ID',
    path: ['stripeProductID'],
  },
);

export type Product = z.infer<typeof ProductBaseSchema>;

/** Main schema export */
export const ProductSchema = ProductBaseSchema;

// =============================================================================
// Create Product Input
// =============================================================================

export const CreateProductInputSchema = z.object({
  title: z.string().min(1).max(200),
  stripeProductID: StripeProductIDSchema.optional(),
  enablePaywall: z.boolean().optional(),
  categories: z.array(z.number().int().positive()).optional(),
  relatedProducts: z.array(z.number().int().positive()).optional(),
  _status: ProductStatusSchema.optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;

// =============================================================================
// Update Product Input
// =============================================================================

export const UpdateProductInputSchema = CreateProductInputSchema.partial();

export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;

// =============================================================================
// Product with Populated Relationships
// =============================================================================

/**
 * Product with categories populated
 */
export const ProductWithCategoriesSchema = ProductObjectSchema.extend({
  categories: z.array(z.object({ id: z.number(), name: z.string() }).passthrough()).nullable(),
});

export type ProductWithCategories = z.infer<typeof ProductWithCategoriesSchema>;

/**
 * Product with all relationships populated
 */
export const ProductWithRelatedSchema = ProductObjectSchema.extend({
  categories: z.array(z.object({ id: z.number(), name: z.string() }).passthrough()).nullable(),
  relatedProducts: z
    .array(
      z.object({
        id: z.number(),
        title: z.string(),
        stripeProductID: z.string().nullable(),
      }),
    )
    .nullable(),
});

export type ProductWithRelated = z.infer<typeof ProductWithRelatedSchema>;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if product has a valid Stripe product configured
 */
export function hasStripeProduct(product: Product): product is Product & {
  stripeProductID: string;
} {
  return !!product.stripeProductID;
}

/**
 * Check if product is published
 */
export function isPublishedProduct(product: Product): boolean {
  return product._status === 'published' && hasStripeProduct(product);
}

/**
 * Check if product has prices
 */
export function hasProductPrices(product: Product): product is Product & {
  priceJSON: StripePriceList;
} {
  return !!product.priceJSON && product.priceJSON !== null;
}

/**
 * Check if product has images
 */
export function hasProductImages(product: Product): boolean {
  // No dedicated images field on the local schema yet.
  // Guard checks stripeProductID as prerequisite for potential Stripe-hosted images.
  if (!hasStripeProduct(product)) return false;
  // Images field not yet in schema; will be checked when added
  return false;
}

// =============================================================================
// Product Utilities
// =============================================================================

/**
 * Get available prices for a product
 */
export function getAvailablePrices(product: Product): StripePriceList['data'] {
  if (!hasProductPrices(product)) return [];
  return product.priceJSON.data.filter((price) => price.active !== false);
}

/**
 * Get price count for product
 */
export function getPriceCount(product: Product): number {
  return getAvailablePrices(product).length;
}

/**
 * Get price range for product (lowest to highest)
 */
export function getPriceRange(product: Product): {
  min: number | null;
  max: number | null;
  currency: string | null;
} | null {
  const prices = getAvailablePrices(product);
  if (prices.length === 0) return null;

  const amounts = prices
    .map((p) => p.unit_amount)
    .filter((amount): amount is number => amount !== null && amount !== undefined);

  if (amounts.length === 0) return null;

  return {
    min: Math.min(...amounts),
    max: Math.max(...amounts),
    currency: prices[0]?.currency || null,
  };
}

/**
 * Get default price ID for product
 */
export function getDefaultPriceId(product: Product): string | null {
  const prices = getAvailablePrices(product);
  return prices.length > 0 && prices[0] ? prices[0].id : null;
}

/**
 * Format price range for display
 */
export function formatPriceRange(product: Product): string | null {
  const range = getPriceRange(product);
  if (!range?.currency) return null;

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: range.currency.toUpperCase(),
  });

  const minAmount = range.min ?? 0;
  const maxAmount = range.max ?? 0;

  if (minAmount === maxAmount) {
    return formatter.format(minAmount / 100);
  }

  return `${formatter.format(minAmount / 100)} - ${formatter.format(maxAmount / 100)}`;
}

// =============================================================================
// Contracts
// =============================================================================

export const ProductContract = createContract({
  name: 'Product',
  version: '1',
  schema: ProductSchema,
  description: 'Stripe-backed product entity with content management',
});

export const CreateProductContract = createContract({
  name: 'CreateProduct',
  version: '1',
  schema: CreateProductInputSchema,
  description: 'Input contract for creating a new product',
});

export const UpdateProductContract = createContract({
  name: 'UpdateProduct',
  version: '1',
  schema: UpdateProductInputSchema,
  description: 'Input contract for updating an existing product',
});
