"use server";
/* eslint-disable prettier/prettier */
import type { RevealBeforeChangeHook } from "@revealui/core";
import type { Product } from "@revealui/core/types/cms";
import { LRUCache } from "@revealui/core/utils/cache";
import { protectedStripe } from "services";

const logs = false;

// Shared cache instance for Stripe API responses
// 5 minute TTL, max 100 entries to prevent memory leaks
const cache = new LRUCache<string, unknown>({
	maxSize: 100,
	ttlMs: 5 * 60 * 1000, // 5 minutes
});

async function cachedRetrieveProduct(productId: string) {
	return cache.fetch(`product_${productId}`, () =>
		protectedStripe.products.retrieve(productId),
	);
}

async function cachedListPrices(productId: string) {
	return cache.fetch(`prices_${productId}`, async () =>
		protectedStripe.prices.list({
			product: productId,
			limit: 100,
		}),
	);
}

export const beforeProductChange: RevealBeforeChangeHook<Product> = async ({
	req,
	data,
}) => {
	const revealui = req?.revealui;
	const newDoc: Product = {
		...data,
		skipSync: false, // Set back to 'false' so that all changes continue to sync to Stripe
	};

	if (data.skipSync) {
		if (logs) revealui?.logger?.info(`Skipping product 'beforeChange' hook`);
		return newDoc;
	}

	if (!data.stripeProductID) {
		if (logs)
			revealui?.logger?.info(
				`No Stripe product assigned to this document, skipping product 'beforeChange' hook`,
			);
		return newDoc;
	}

	try {
		// Validate the product exists in Stripe before proceeding
		// This ensures data consistency and provides early error detection
		const stripeProduct = await cachedRetrieveProduct(data.stripeProductID);
		if (logs)
			revealui?.logger?.info(
				`Found product from Stripe: ${stripeProduct.name}`,
			);
	} catch (error) {
		// If product doesn't exist in Stripe, fail early to prevent inconsistent state
		revealui?.logger?.error(`Error fetching product from Stripe: ${error}`);
		return newDoc;
	}

	try {
		const allPrices = await cachedListPrices(data.stripeProductID);
		newDoc.priceJSON = JSON.stringify(allPrices);
	} catch (error) {
		revealui?.logger?.error(`Error fetching prices from Stripe: ${error}`);
	}

	return newDoc;
};

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
