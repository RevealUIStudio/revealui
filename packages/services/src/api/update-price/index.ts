/* eslint-disable @typescript-eslint/no-explicit-any */
import type Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";

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
      data: { priceJSON: string; skipSync: boolean };
    }): unknown;
    logger: {
      info: (message: string) => void;
      error: (message: string) => void;
    };
  };
  stripe: Stripe;
}) => Promise<void>;

const logs = false;

export const updatePrice: StripeWebhookHandler<{
  data: {
    object: Stripe.Price;
  };
}> = async (args) => {
  const { event, payload, stripe } = args;

  const stripeProduct = (event.data.object as Stripe.Price).product;
  const stripeProductID =
    typeof stripeProduct === "string" ? stripeProduct : stripeProduct.id;

  if (logs)
    payload.logger.info(
      `🪝 A price was created or updated in Stripe on product ID: ${stripeProductID}, syncing to Payload...`,
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
          `- Found existing product with Stripe ID: ${stripeProductID}, saving price...`,
        );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    payload.logger.error(`Error finding product ${msg}`);
  }

  try {
    // find all stripe prices that are assigned to "payloadProductID"
    const stripePrices = await stripe.prices.list({
      product: stripeProductID,
      limit: 100,
    });

    await payload.update({
      collection: "products",
      id: payloadProductID || "",
      data: {
        priceJSON: JSON.stringify(stripePrices),
        skipSync: true,
      },
    });

    if (logs) payload.logger.info(`✅ Successfully updated product price.`);
  } catch (error: unknown) {
    payload.logger.error(`- Error updating product price: ${error}`);
  }
};

export async function POST(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const { event, payload, stripe } = req.body;

  try {
    await updatePrice({ event, payload, stripe });
    res.status(200).send("Product updated successfully");
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).send("Internal Server Error");
  }
}
// /* eslint-disable @typescript-eslint/no-explicit-any */
// import type Stripe from "stripe";

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
//       data: { priceJSON: string; skipSync: boolean };
//     }): unknown;
//     logger: {
//       info: (message: string) => void;
//       error: (message: string) => void;
//     };
//   };
//   stripe: Stripe;
// }) => Promise<void>;

// const logs = false;

// export const updatePrice: StripeWebhookHandler<{
//   data: {
//     object: Stripe.Price;
//   };
// }> = async (args) => {
//   const { event, payload, stripe } = args;

//   const stripeProduct = (event.data.object as Stripe.Price).product;
//   const stripeProductID =
//     typeof stripeProduct === "string" ? stripeProduct : stripeProduct.id;

//   if (logs)
//     payload.logger.info(
//       `🪝 A price was created or updated in Stripe on product ID: ${stripeProductID}, syncing to Payload...`,
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
//           `- Found existing product with Stripe ID: ${stripeProductID}, saving price...`,
//         );
//     }
//   } catch (err: unknown) {
//     const msg = err instanceof Error ? err.message : "Unknown error";
//     payload.logger.error(`Error finding product ${msg}`);
//   }

//   try {
//     // find all stripe prices that are assigned to "payloadProductID"
//     const stripePrices = await stripe.prices.list({
//       product: stripeProductID,
//       limit: 100,
//     });

//     await payload.update({
//       collection: "products",
//       id: payloadProductID || "",
//       data: {
//         priceJSON: JSON.stringify(stripePrices),
//         skipSync: true,
//       },
//     });

//     if (logs) payload.logger.info(`✅ Successfully updated product price.`);
//   } catch (error: unknown) {
//     payload.logger.error(`- Error updating product price: ${error}`);
//   }
// };
// /* eslint-disable @typescript-eslint/no-explicit-any */
// import type Stripe from "stripe";

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
//       data: { priceJSON: string; skipSync: boolean };
//     }): unknown;
//     logger: {
//       info: (message: string) => void;
//       error: (message: string) => void;
//     };
//   };
//   stripe: Stripe;
// }) => Promise<void>;

// const logs = false;

// export const updatePrice: StripeWebhookHandler<{
//   data: {
//     object: Stripe.Price;
//   };
// }> = async (args) => {
//   const { event, payload, stripe } = args;

//   const stripeProduct = (event.data.object as Stripe.Price).product;
//   const stripeProductID =
//     typeof stripeProduct === "string" ? stripeProduct : stripeProduct.id;

//   if (logs)
//     payload.logger.info(
//       `🪝 A price was created or updated in Stripe on product ID: ${stripeProductID}, syncing to Payload...`,
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
//           `- Found existing product with Stripe ID: ${stripeProductID}, saving price...`,
//         );
//     }
//   } catch (err: unknown) {
//     const msg = err instanceof Error ? err.message : "Unknown error";
//     payload.logger.error(`Error finding product ${msg}`);
//   }

//   try {
//     // find all stripe prices that are assigned to "payloadProductID"
//     const stripePrices = await stripe.prices.list({
//       product: stripeProductID,
//       limit: 100,
//     });

//     await payload.update({
//       collection: "products",
//       id: payloadProductID || "",
//       data: {
//         priceJSON: JSON.stringify(stripePrices),
//         skipSync: true,
//       },
//     });

//     if (logs) payload.logger.info(`✅ Successfully updated product price.`);
//   } catch (error: unknown) {
//     payload.logger.error(`- Error updating product price: ${error}`);
//   }
// };
