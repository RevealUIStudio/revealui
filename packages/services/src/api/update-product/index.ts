// api/update-product.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";

const logs = false;

export type StripeWebhookHandler<T> = (args: {
  event: Stripe.Event & T;
  revealui: {
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
  const { event, revealui, stripe } = args;

  const {
    id: stripeProductID,
    name: stripeProductName,
    description: stripeDescription,
  } = event.data.object;

  if (logs)
    revealui.logger.info(
      `Syncing Stripe product with ID: ${stripeProductID} to RevealUI...
      Product name: ${stripeProductName}
      Product description: ${stripeDescription}`,
    );

  let revealuiProductID;

  // First lookup the product in RevealUI
  try {
    if (logs) revealui.logger.info(`- Looking up existing RevealUI product...`);

    const productQuery: any = await revealui.find({
      collection: "products",
      where: {
        stripeProductID: {
          equals: stripeProductID,
        },
      },
    });

    revealuiProductID = productQuery.docs?.[0]?.id;

    if (revealuiProductID) {
      if (logs)
        revealui.logger.info(
          `- Found existing product with Stripe ID: ${stripeProductID}, syncing now...`,
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    revealui.logger.error(`Error finding product ${message}`);
  }

  let prices;

  try {
    if (logs)
      revealui.logger.info(
        `- Looking up all prices associated with this product...`,
      );

    // Find all stripe prices that are assigned to "revealuiProductID"
    prices = await stripe.prices.list({
      product: stripeProductID,
      limit: 100,
    });
  } catch (error: unknown) {
    revealui.logger.error(`- Error looking up prices: ${error}`);
  }

  try {
    if (logs) revealui.logger.info(`- Updating document...`);

    await revealui.update({
      collection: "products",
      id: revealuiProductID || "",
      data: {
        name: stripeProductName,
        description: stripeDescription,
        priceJSON: JSON.stringify(prices),
        skipSync: true,
      },
    });

    if (logs) revealui.logger.info(`✅ Successfully updated product.`);
  } catch (error: unknown) {
    revealui.logger.error(`- Error updating product: ${error}`);
  }
};

export async function POST(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const { event, revealui, stripe } = req.body;

  try {
    await updateProduct({ event, revealui, stripe });
    res.status(200).send("Product updated successfully");
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).send("Internal Server Error");
  }
}
