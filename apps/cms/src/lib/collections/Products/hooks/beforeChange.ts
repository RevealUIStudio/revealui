/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PayloadRequest } from "payload";
import { stripe } from "services";

const logs = false;

// Simulate React's cache with an automatic invalidation mechanism
class Cache {
  private cache = new Map();

  async fetch(key: string, fetcher: () => Promise<any>) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    } else {
      const data = await fetcher();
      this.cache.set(key, data);
      return data;
    }
  }
}

const cache = new Cache();

async function cachedRetrieveProduct(productId: string) {
  return cache.fetch(`product_${productId}`, () =>
    stripe.products.retrieve(productId),
  );
}

async function cachedListPrices(productId: string) {
  return cache.fetch(`prices_${productId}`, () =>
    stripe.prices.list({
      product: productId,
      limit: 100,
    }),
  );
}

export const beforeProductChange = async ({
  req,
  data,
}: {
  req: PayloadRequest;
  data: any;
}) => {
  const { payload } = req;
  const newDoc: Record<string, unknown> = {
    ...data,
    skipSync: false, // Set back to 'false' so that all changes continue to sync to Stripe
  };

  if (data.skipSync) {
    if (logs) payload.logger.info(`Skipping product 'beforeChange' hook`);
    return newDoc;
  }

  if (!data.stripeProductID) {
    if (logs)
      payload.logger.info(
        `No Stripe product assigned to this document, skipping product 'beforeChange' hook`,
      );
    return newDoc;
  }

  try {
    const stripeProduct = await cachedRetrieveProduct(data.stripeProductID);
    if (logs)
      payload.logger.info(`Found product from Stripe: ${stripeProduct.name}`);
    newDoc.description = stripeProduct.description;
  } catch (error) {
    payload.logger.error(`Error fetching product from Stripe: ${error}`);
    return newDoc;
  }

  try {
    const allPrices = await cachedListPrices(data.stripeProductID);
    newDoc.priceJSON = JSON.stringify(allPrices);
  } catch (error) {
    payload.logger.error(`Error fetching prices from Stripe: ${error}`);
  }

  return newDoc;
};

// import { PayloadRequest } from "payload";
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
//   req: PayloadRequest;
//   data: any;
// }) => {
//   const { payload } = req;
//   const newDoc: Record<string, unknown> = {
//     ...data,
//     skipSync: false, // Set back to 'false' so that all changes continue to sync to Stripe
//   };

//   if (data.skipSync) {
//     if (logs) payload.logger.info(`Skipping product 'beforeChange' hook`);
//     return newDoc;
//   }

//   if (!data.stripeProductID) {
//     if (logs)
//       payload.logger.info(
//         `No Stripe product assigned to this document, skipping product 'beforeChange' hook`,
//       );
//     return newDoc;
//   }

//   if (logs) payload.logger.info(`Looking up product from Stripe...`);

//   try {
//     const stripeProduct = await cachedRetrieveProduct(data.stripeProductID);
//     if (logs)
//       payload.logger.info(`Found product from Stripe: ${stripeProduct.name}`);
//     newDoc.description = stripeProduct.description;
//   } catch (error: unknown) {
//     payload.logger.error(`Error fetching product from Stripe: ${error}`);
//     return newDoc;
//   }

//   if (logs) payload.logger.info(`Looking up price from Stripe...`);

//   try {
//     const allPrices = await cachedListPrices(data.stripeProductID);

//     newDoc.priceJSON = JSON.stringify(allPrices);
//   } catch (error: unknown) {
//     payload.logger.error(`Error fetching prices from Stripe: ${error}`);
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
//   const { payload } = req;
//   const newDoc: Record<string, unknown> = {
//     ...data,
//     skipSync: false, // Set back to 'false' so that all changes continue to sync to Stripe
//   };

//   if (data.skipSync) {
//     if (logs) payload.logger.info(`Skipping product 'beforeChange' hook`);
//     return newDoc;
//   }

//   if (!data.stripeProductID) {
//     if (logs)
//       payload.logger.info(
//         `No Stripe product assigned to this document, skipping product 'beforeChange' hook`,
//       );
//     return newDoc;
//   }

//   if (logs) payload.logger.info(`Looking up product from Stripe...`);

//   try {
//     const stripeProduct = await stripe.products.retrieve(data.stripeProductID);
//     if (logs)
//       payload.logger.info(`Found product from Stripe: ${stripeProduct.name}`);
//     // newDoc.name = stripeProduct.name;
//     newDoc.description = stripeProduct.description;
//   } catch (error: unknown) {
//     payload.logger.error(`Error fetching product from Stripe: ${error}`);
//     return newDoc;
//   }

//   if (logs) payload.logger.info(`Looking up price from Stripe...`);

//   try {
//     const allPrices = await stripe.prices.list({
//       product: data.stripeProductID,
//       limit: 100,
//     });

//     newDoc.priceJSON = JSON.stringify(allPrices);
//   } catch (error: unknown) {
//     payload.logger.error(`Error fetching prices from Stripe: ${error}`);
//   }

//   return newDoc;
// };
