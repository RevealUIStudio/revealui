import type { RevealBeforeChangeHook } from '@revealui/core'
import type { Price } from '@revealui/core/types/cms'
import { LRUCache } from '@revealui/core/utils/cache'
import { protectedStripe } from 'services'

const logs = false

// Shared cache instance for Stripe API responses
// 5 minute TTL, max 100 entries to prevent memory leaks
const cache = new LRUCache<string, unknown>({
  maxSize: 100,
  ttlMs: 5 * 60 * 1000, // 5 minutes
})

// Retrieve a single Stripe price by price ID
async function cachedRetrievePrice(priceId: string) {
  return cache.fetch(`price_${priceId}`, async () =>
    protectedStripe.prices.retrieve(priceId),
  ) as Promise<unknown>
}

export const beforePriceChange: RevealBeforeChangeHook<Price> = async ({ req, data }) => {
  const revealui = req?.revealui
  const newDoc: Price = {
    ...data,
    skipSync: false, // Set back to 'false' so that all changes continue to sync to Stripe
  }

  if (data.skipSync) {
    if (logs) revealui?.logger?.info(`Skipping price 'beforeChange' hook`)
    return newDoc
  }

  if (!data.stripePriceID) {
    if (logs)
      revealui?.logger?.info(
        `No Stripe price assigned to this document, skipping price 'beforeChange' hook`,
      )
    return newDoc
  }

  try {
    // Validate the price exists in Stripe and get price details
    const stripePrice = await cachedRetrievePrice(data.stripePriceID)
    if (logs && stripePrice && typeof stripePrice === 'object' && 'id' in stripePrice) {
      revealui?.logger?.info(`Found price from Stripe: ${stripePrice.id}`)
    }
    // Store the price object as JSON for reference
    newDoc.priceJSON = JSON.stringify(stripePrice)
  } catch (error) {
    revealui?.logger?.error(`Error fetching price from Stripe: ${error}`)
    return newDoc
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
