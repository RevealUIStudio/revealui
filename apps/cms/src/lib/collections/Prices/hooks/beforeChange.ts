import {
  type StripePriceData,
  StripePriceDataSchema,
  StripePriceIDSchema,
} from '@revealui/contracts/entities'
import type { RevealBeforeChangeHook } from '@revealui/core'
import type { Price } from '@revealui/core/types/cms'
import { LRUCache } from '@revealui/core/utils/cache'
import { protectedStripe } from 'services'

const logs = false

// Shared cache instance for Stripe API responses
// 5 minute TTL, max 100 entries to prevent memory leaks
const cache = new LRUCache<string, StripePriceData>({
  maxSize: 100,
  ttlMs: 5 * 60 * 1000, // 5 minutes
})

// Retrieve a single Stripe price by price ID with caching
async function cachedRetrievePrice(priceId: string): Promise<StripePriceData> {
  return cache.fetch(`price_${priceId}`, async () => {
    const price = await protectedStripe.prices.retrieve(priceId)
    // Validate the Stripe response matches expected structure
    const validatedPrice = StripePriceDataSchema.parse(price)
    return validatedPrice
  })
}

/**
 * Validates stripePriceID format before making API calls
 */
function validateStripePriceID(priceId: string | null | undefined): {
  valid: boolean
  error?: string
} {
  if (!priceId) {
    return { valid: false, error: 'Stripe Price ID is required' }
  }

  const result = StripePriceIDSchema.safeParse(priceId)
  if (!result.success) {
    const errorMessage = result.error.errors[0]?.message || 'Invalid Stripe Price ID format'
    return { valid: false, error: errorMessage }
  }

  return { valid: true }
}

/**
 * Validates business rules for price data
 */
function validatePriceBusinessRules(
  data: Price,
  stripePrice: StripePriceData,
): { valid: boolean; error?: string } {
  // Business rule: published prices must have valid Stripe price
  if (data._status === 'published') {
    if (!stripePrice.active) {
      return {
        valid: false,
        error: 'Cannot publish a price with inactive Stripe price',
      }
    }

    if (stripePrice.unit_amount === null) {
      return {
        valid: false,
        error: 'Cannot publish a price without a unit amount',
      }
    }

    if (stripePrice.unit_amount < 0) {
      return {
        valid: false,
        error: 'Price amount must be positive',
      }
    }
  }

  // Verify price ID matches
  if (stripePrice.id !== data.stripePriceID) {
    return {
      valid: false,
      error: 'Stripe price ID mismatch',
    }
  }

  return { valid: true }
}

export const beforePriceChange: RevealBeforeChangeHook<Price> = async ({ req, data }) => {
  const revealui = req?.revealui
  const newDoc: Price = {
    ...data,
    skipSync: false, // Set back to 'false' so that all changes continue to sync to Stripe
  }

  // Skip sync if explicitly requested
  if (data.skipSync) {
    if (logs) revealui?.logger?.info(`Skipping price 'beforeChange' hook`)
    return newDoc
  }

  // Allow draft prices without Stripe price configured
  if (!data.stripePriceID) {
    if (data._status === 'published') {
      revealui?.logger?.error(
        'Cannot publish price without Stripe Price ID configured. Please add a valid Stripe price.',
      )
      throw new Error('Published prices must have a valid Stripe Price ID')
    }

    if (logs) {
      revealui?.logger?.info(
        `No Stripe price assigned to this document, skipping price 'beforeChange' hook`,
      )
    }
    return newDoc
  }

  // Validate Stripe Price ID format
  const idValidation = validateStripePriceID(data.stripePriceID)
  if (!idValidation.valid) {
    revealui?.logger?.error(`Invalid Stripe Price ID: ${idValidation.error}`)
    throw new Error(`Invalid Stripe Price ID: ${idValidation.error}`)
  }

  try {
    // Fetch and validate the price from Stripe
    const stripePrice = await cachedRetrievePrice(data.stripePriceID)

    if (logs) {
      revealui?.logger?.info(
        `Found price from Stripe: ${stripePrice.id} (${stripePrice.currency} ${stripePrice.unit_amount ? stripePrice.unit_amount / 100 : 'N/A'})`,
      )
    }

    // Validate business rules
    const businessValidation = validatePriceBusinessRules(newDoc, stripePrice)
    if (!businessValidation.valid) {
      revealui?.logger?.error(`Price validation failed: ${businessValidation.error}`)
      throw new Error(`Price validation failed: ${businessValidation.error}`)
    }

    // Store the validated price object as JSON
    newDoc.priceJSON = JSON.stringify(stripePrice)
  } catch (error) {
    // Check if it's a validation error (already logged)
    if (error instanceof Error && error.message.startsWith('Price validation failed')) {
      throw error
    }

    // Check if it's a Stripe API error
    const isStripeError = error && typeof error === 'object' && 'type' in error

    if (isStripeError) {
      const stripeErrorMessage = 'message' in error ? String(error.message) : 'Unknown error'
      revealui?.logger?.error(
        `Stripe API error for price ${data.stripePriceID}: ${stripeErrorMessage}`,
      )
      throw new Error(
        `Failed to fetch price from Stripe: ${stripeErrorMessage}. Please verify the price ID is correct.`,
      )
    }

    // Generic error
    revealui?.logger?.error(`Error fetching price from Stripe: ${error}`)
    throw new Error(
      `Failed to validate price with Stripe: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }

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

// /* eslint-disable @typescript-eslint/no-explicit-any */
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
