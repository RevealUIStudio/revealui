'use server'

import {
  StripePriceListSchema,
  StripeProductDataSchema,
  StripeProductIDSchema,
} from '@revealui/contracts/entities'
import type { RevealBeforeChangeHook } from '@revealui/core'
import type { Product } from '@revealui/core/types/cms'
import { LRUCache } from '@revealui/core/utils/cache'
import { protectedStripe } from '@revealui/services'
import type Stripe from 'stripe'

const logs = false

/**
 * Products beforeChange Hook - Enhanced Validation
 *
 * Responsibilities:
 * 1. Validate Stripe Product ID format (prod_xxx)
 * 2. Fetch and validate Stripe product data
 * 3. Fetch and store associated prices
 * 4. Enforce business rules (published products need valid Stripe data)
 * 5. Provide comprehensive error handling
 *
 * Features:
 * - Runtime validation with Zod schemas
 * - LRU caching for Stripe API responses
 * - Type-safe Stripe integration
 * - Detailed error messages
 * - Business rule enforcement
 */

// Shared cache instance for Stripe API responses
// 5 minute TTL, max 100 entries to prevent memory leaks
const productCache = new LRUCache<string, Stripe.Product>({
  maxSize: 100,
  ttlMs: 5 * 60 * 1000, // 5 minutes
})

const pricesCache = new LRUCache<string, Stripe.ApiList<Stripe.Price>>({
  maxSize: 100,
  ttlMs: 5 * 60 * 1000, // 5 minutes
})

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate Stripe Product ID format
 * @param productId - The Stripe product ID to validate
 * @returns Validation result with optional error message
 */
function validateStripeProductID(productId: string | null | undefined): {
  valid: boolean
  error?: string
} {
  if (!productId) {
    return { valid: false, error: 'Stripe Product ID is required' }
  }

  const result = StripeProductIDSchema.safeParse(productId)
  if (!result.success) {
    return {
      valid: false,
      error: result.error.issues[0]?.message || 'Invalid Stripe Product ID format',
    }
  }

  return { valid: true }
}

/**
 * Validate Stripe product data structure
 * @param productData - The Stripe product data to validate
 * @returns Validation result with optional error message
 */
function validateStripeProductData(productData: unknown): {
  valid: boolean
  error?: string
} {
  const result = StripeProductDataSchema.safeParse(productData)
  if (!result.success) {
    return {
      valid: false,
      error: result.error.issues[0]?.message || 'Invalid Stripe product data structure',
    }
  }

  return { valid: true }
}

/**
 * Validate Stripe price list structure
 * @param priceList - The Stripe price list to validate
 * @returns Validation result with optional error message
 */
function validateStripePriceList(priceList: unknown): {
  valid: boolean
  error?: string
} {
  const result = StripePriceListSchema.safeParse(priceList)
  if (!result.success) {
    return {
      valid: false,
      error: result.error.issues[0]?.message || 'Invalid Stripe price list structure',
    }
  }

  return { valid: true }
}

// =============================================================================
// Stripe API Helpers (with caching)
// =============================================================================

/**
 * Retrieve Stripe product with caching
 * @param productId - The Stripe product ID
 * @returns Stripe product data
 */
async function cachedRetrieveProduct(productId: string): Promise<Stripe.Product> {
  return productCache.fetch(`product_${productId}`, () =>
    protectedStripe.products.retrieve(productId),
  )
}

/**
 * List prices for a product with caching
 * @param productId - The Stripe product ID
 * @returns Stripe price list
 */
async function cachedListPrices(productId: string): Promise<Stripe.ApiList<Stripe.Price>> {
  return pricesCache.fetch(`prices_${productId}`, async () =>
    protectedStripe.prices.list({
      product: productId,
      limit: 100,
    }),
  )
}

// =============================================================================
// Main Hook
// =============================================================================

export const beforeProductChange: RevealBeforeChangeHook<Product> = async ({ req, data }) => {
  const revealui = req?.revealui
  const newDoc: Product = {
    ...data,
    skipSync: false, // Reset to false so changes continue to sync
  }

  // Skip validation if skipSync flag is set
  if (data.skipSync) {
    if (logs) revealui?.logger?.info('Skipping product validation (skipSync=true)')
    return newDoc
  }

  // Skip Stripe integration if no product ID provided
  if (!data.stripeProductID) {
    // Allow draft products without Stripe product
    if (data._status !== 'published') {
      if (logs) revealui?.logger?.info('Draft product without Stripe ID, skipping validation')
      return newDoc
    }

    // Published products must have Stripe product
    throw new Error('Published products must have a valid Stripe Product ID')
  }

  // =============================================================================
  // Step 1: Validate Stripe Product ID format
  // =============================================================================
  const formatValidation = validateStripeProductID(data.stripeProductID)
  if (!formatValidation.valid) {
    throw new Error(`Invalid Stripe Product ID: ${formatValidation.error}`)
  }

  if (logs) revealui?.logger?.info(`Validating Stripe product: ${data.stripeProductID}`)

  // =============================================================================
  // Step 2: Fetch and validate Stripe product data
  // =============================================================================
  let stripeProduct: Stripe.Product
  try {
    stripeProduct = await cachedRetrieveProduct(data.stripeProductID)
    if (logs) revealui?.logger?.info(`Found Stripe product: ${stripeProduct.name}`)

    // Validate product data structure
    const productValidation = validateStripeProductData(stripeProduct)
    if (!productValidation.valid) {
      throw new Error(`Invalid product data from Stripe: ${productValidation.error}`)
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error fetching product from Stripe'
    revealui?.logger?.error(`Error validating Stripe product: ${errorMessage}`)
    throw new Error(`Failed to validate Stripe product: ${errorMessage}`)
  }

  // =============================================================================
  // Step 3: Fetch and validate price list
  // =============================================================================
  try {
    const priceList = await cachedListPrices(data.stripeProductID)
    if (logs) revealui?.logger?.info(`Found ${priceList.data.length} prices for product`)

    // Validate price list structure
    const priceValidation = validateStripePriceList(priceList)
    if (!priceValidation.valid) {
      throw new Error(`Invalid price list from Stripe: ${priceValidation.error}`)
    }

    // Store validated price list
    newDoc.priceJSON = JSON.stringify(priceList)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error fetching prices from Stripe'
    revealui?.logger?.error(`Error fetching prices: ${errorMessage}`)
    // Don't throw here - product can exist without prices
    // Just log the error and continue
  }

  // =============================================================================
  // Step 4: Business rule validations
  // =============================================================================

  // Published products must be active in Stripe
  if (data._status === 'published' && !stripeProduct.active) {
    throw new Error('Cannot publish product: Stripe product is not active')
  }

  if (logs) revealui?.logger?.info('Product validation successful')
  return newDoc
}

// import { RevealRequest } from "@revealui/core";
// import Stripe from "stripe";

// const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
// const stripe = new Stripe(stripeSecretKey || "", { apiVersion: "2024-06-20" });

// const logs = false;

// // Example caching function
// const cache = new Map();

// async function cachedRetrieveProduct(productId: string) {
//   const cacheKey = `product_${productId}`;
//   if (cache.has(cacheKey)) {
//     return cache.get(cacheKey);
//   } else {
//     const product = await stripe.products.retrieve(productId);
//     cache.set(cacheKey, product);
//     return product;
//   }
// }

// async function cachedListPrices(productId: string) {
//   const cacheKey = `prices_${productId}`;
//   if (cache.has(cacheKey)) {
//     return cache.get(cacheKey);
//   } else {
//     const prices = await stripe.prices.list({
//       product: productId,
//       limit: 100,
//     });
//     cache.set(cacheKey, prices);
//     return prices;
//   }
// }

// export const beforeProductChange = async ({
//   req,
//   data,
// }: {
//   req: RevealRequest;
//   data: any;
// }) => {
//   const { revealui } = req;
//   const newDoc: Record<string, unknown> = {
//     ...data,
//     skipSync: false, // Set back to 'false' so that all changes continue to sync to Stripe
//   };

//   if (data.skipSync) {
//     if (logs) revealui.logger.info(`Skipping product 'beforeChange' hook`);
//     return newDoc;
//   }

//   if (!data.stripeProductID) {
//     if (logs)
//       revealui.logger.info(
//         `No Stripe product assigned to this document, skipping product 'beforeChange' hook`,
//       );
//     return newDoc;
//   }

//   if (logs) revealui.logger.info(`Looking up product from Stripe...`);

//   try {
//     const stripeProduct = await cachedRetrieveProduct(data.stripeProductID);
//     if (logs)
//       revealui.logger.info(`Found product from Stripe: ${stripeProduct.name}`);
//     newDoc.description = stripeProduct.description;
//   } catch (error: unknown) {
//     revealui.logger.error(`Error fetching product from Stripe: ${error}`);
//     return newDoc;
//   }

//   if (logs) revealui.logger.info(`Looking up price from Stripe...`);

//   try {
//     const allPrices = await cachedListPrices(data.stripeProductID);

//     newDoc.priceJSON = JSON.stringify(allPrices);
//   } catch (error: unknown) {
//     revealui.logger.error(`Error fetching prices from Stripe: ${error}`);
//   }

//   return newDoc;
// };

// import Stripe from "stripe";

// const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
// const stripe = new Stripe(stripeSecretKey || "", { apiVersion: "2024-06-20" });

// const logs = false;

// export const beforeProductChange = async ({
//   req,
//   data,
// }: {
//   req: any;
//   data: any;
// }) => {
//   const { revealui } = req;
//   const newDoc: Record<string, unknown> = {
//     ...data,
//     skipSync: false, // Set back to 'false' so that all changes continue to sync to Stripe
//   };

//   if (data.skipSync) {
//     if (logs) revealui.logger.info(`Skipping product 'beforeChange' hook`);
//     return newDoc;
//   }

//   if (!data.stripeProductID) {
//     if (logs)
//       revealui.logger.info(
//         `No Stripe product assigned to this document, skipping product 'beforeChange' hook`,
//       );
//     return newDoc;
//   }

//   if (logs) revealui.logger.info(`Looking up product from Stripe...`);

//   try {
//     const stripeProduct = await stripe.products.retrieve(data.stripeProductID);
//     if (logs)
//       revealui.logger.info(`Found product from Stripe: ${stripeProduct.name}`);
//     // newDoc.name = stripeProduct.name;
//     newDoc.description = stripeProduct.description;
//   } catch (error: unknown) {
//     revealui.logger.error(`Error fetching product from Stripe: ${error}`);
//     return newDoc;
//   }

//   if (logs) revealui.logger.info(`Looking up price from Stripe...`);

//   try {
//     const allPrices = await stripe.prices.list({
//       product: data.stripeProductID,
//       limit: 100,
//     });

//     newDoc.priceJSON = JSON.stringify(allPrices);
//   } catch (error: unknown) {
//     revealui.logger.error(`Error fetching prices from Stripe: ${error}`);
//   }

//   return newDoc;
// };
