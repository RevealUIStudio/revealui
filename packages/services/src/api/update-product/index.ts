// api/update-product.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";

const logs = false;

export type StripeWebhookHandler<T> = (args: {
  event: Stripe.Event & T;
  payload: {
    find(arg0: {
      collection: string;
      where: { stripeProductID: { equals: string } };
    }): unknown;
    update(arg0: {
      collection: string;
      id: any;
      data: {
        priceJSON: string;
        skipSync: boolean;
        name: string;
        description: string | null;
      };
    }): unknown;
    logger: {
      info: (message: string) => void;
      error: (message: string) => void;
    };
  };
  stripe: Stripe;
}) => Promise<void>;

export const updateProduct: StripeWebhookHandler<{
  data: {
    object: Stripe.Product;
  };
}> = async (args) => {
  const { event, payload, stripe } = args;

  const {
    id: stripeProductID,
    name: stripeProductName,
    description: stripeDescription,
  } = event.data.object;

  if (logs)
    payload.logger.info(
      `Syncing Stripe product with ID: ${stripeProductID} to Payload...
      Product name: ${stripeProductName}
      Product description: ${stripeDescription}`,
    );

  let payloadProductID;

  // First lookup the product in Payload
  try {
    if (logs) payload.logger.info(`- Looking up existing Payload product...`);

    const productQuery: any = await payload.find({
      collection: "products",
      where: {
        stripeProductID: {
          equals: stripeProductID,
        },
      },
    });

    payloadProductID = productQuery.docs?.[0]?.id;

    if (payloadProductID) {
      if (logs)
        payload.logger.info(
          `- Found existing product with Stripe ID: ${stripeProductID}, syncing now...`,
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    payload.logger.error(`Error finding product ${message}`);
  }

  let prices;

  try {
    if (logs)
      payload.logger.info(
        `- Looking up all prices associated with this product...`,
      );

    // find all stripe prices that are assigned to "payloadProductID"
    prices = await stripe.prices.list({
      product: stripeProductID,
      limit: 100,
    });
  } catch (error: unknown) {
    payload.logger.error(`- Error looking up prices: ${error}`);
  }

  try {
    if (logs) payload.logger.info(`- Updating document...`);

    await payload.update({
      collection: "products",
      id: payloadProductID || "",
      data: {
        name: stripeProductName,
        description: stripeDescription,
        priceJSON: JSON.stringify(prices),
        skipSync: true,
      },
    });

    if (logs) payload.logger.info(`✅ Successfully updated product.`);
  } catch (error: unknown) {
    payload.logger.error(`- Error updating product: ${error}`);
  }
};

export async function POST(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const { event, payload, stripe } = req.body;

  try {
    await updateProduct({ event, payload, stripe });
    res.status(200).send("Product updated successfully");
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).send("Internal Server Error");
  }
}
// /* eslint-disable @typescript-eslint/no-explicit-any */

// import type Stripe from "stripe";

// const logs = false;
// export type StripeWebhookHandler<T> = (args: {
//   event: Stripe.Event & T;
//   payload: {
//     find(arg0: {
//       collection: string;
//       where: { stripeProductID: { equals: string } };
//     }): unknown;
//     update(arg0: {
//       collection: string;
//       id: any;
//       data: {
//         priceJSON: string;
//         skipSync: boolean;
//         name: string;
//         description: string | null;
//       };
//     }): unknown;
//     logger: {
//       info: (message: string) => void;
//       error: (message: string) => void;
//     };
//   };
//   stripe: Stripe;
// }) => Promise<void>;
// export const updateProduct: StripeWebhookHandler<{
//   data: {
//     object: Stripe.Product;
//   };
// }> = async (args) => {
//   const { event, payload, stripe } = args;

//   const {
//     id: stripeProductID,
//     name: stripeProductName,
//     description: stripeDescription,
//   } = event.data.object;

//   if (logs)
//     payload.logger.info(
//       `Syncing Stripe product with ID: ${stripeProductID} to Payload...
//       Product name: ${stripeProductName}
//       Product description: ${stripeDescription}`,
//     );

//   let payloadProductID;

//   // First lookup the product in Payload
//   try {
//     if (logs) payload.logger.info(`- Looking up existing Payload product...`);

//     const productQuery: any = await payload.find({
//       collection: "products",
//       where: {
//         stripeProductID: {
//           equals: stripeProductID,
//         },
//       },
//     });

//     payloadProductID = productQuery.docs?.[0]?.id;

//     if (payloadProductID) {
//       if (logs)
//         payload.logger.info(
//           `- Found existing product with Stripe ID: ${stripeProductID}, syncing now...`,
//         );
//     }
//   } catch (error: unknown) {
//     const message = error instanceof Error ? error.message : "Unknown error";
//     payload.logger.error(`Error finding product ${message}`);
//   }

//   let prices;

//   try {
//     if (logs)
//       payload.logger.info(
//         `- Looking up all prices associated with this product...`,
//       );

//     // find all stripe prices that are assigned to "payloadProductID"
//     prices = await stripe.prices.list({
//       product: stripeProductID,
//       limit: 100,
//     });
//   } catch (error: unknown) {
//     payload.logger.error(`- Error looking up prices: ${error}`);
//   }

//   try {
//     if (logs) payload.logger.info(`- Updating document...`);

//     await payload.update({
//       collection: "products",
//       id: payloadProductID || "",
//       data: {
//         name: stripeProductName,
//         description: stripeDescription,
//         priceJSON: JSON.stringify(prices),
//         skipSync: true,
//       },
//     });

//     if (logs) payload.logger.info(`✅ Successfully updated product.`);
//   } catch (error: unknown) {
//     payload.logger.error(`- Error updating product: ${error}`);
//   }
// };
