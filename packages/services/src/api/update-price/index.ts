/* eslint-disable @typescript-eslint/no-explicit-any */
import type Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";

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
  const { event, revealui, stripe } = args;

  const stripeProduct = (event.data.object as Stripe.Price).product;
  const stripeProductID =
    typeof stripeProduct === "string" ? stripeProduct : stripeProduct.id;

  if (logs)
    revealui.logger.info(
      `🪝 A price was created or updated in Stripe on product ID: ${stripeProductID}, syncing to RevealUI...`,
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
          `- Found existing product with Stripe ID: ${stripeProductID}, saving price...`,
        );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    revealui.logger.error(`Error finding product ${msg}`);
  }

  try {
    // Find all stripe prices that are assigned to "revealuiProductID"
    const stripePrices = await stripe.prices.list({
      product: stripeProductID,
      limit: 100,
    });

    await revealui.update({
      collection: "products",
      id: revealuiProductID || "",
      data: {
        priceJSON: JSON.stringify(stripePrices),
        skipSync: true,
      },
    });

    if (logs) revealui.logger.info(`✅ Successfully updated product price.`);
  } catch (error: unknown) {
    revealui.logger.error(`- Error updating product price: ${error}`);
  }
};

export async function POST(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const { event, revealui, stripe } = req.body;

  try {
    await updatePrice({ event, revealui, stripe });
    res.status(200).send("Product updated successfully");
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).send("Internal Server Error");
  }
}
