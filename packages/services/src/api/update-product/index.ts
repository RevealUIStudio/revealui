// api/update-product.ts

import { logger } from '@revealui/core/utils/logger';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type Stripe from 'stripe';

const logs = false;

interface RevealUIQueryResult {
  docs?: Array<{ id: string | number }>;
}

interface RevealUIInstance {
  find(arg0: {
    collection: string;
    where: { stripeProductID: { equals: string } };
  }): Promise<RevealUIQueryResult>;
  update(arg0: {
    collection: string;
    id: string | number;
    data: {
      priceJSON: string;
      skipSync: boolean;
      name: string;
      description: string | null;
    };
  }): Promise<unknown>;
  logger: {
    info: (message: string) => void;
    error: (message: string) => void;
  };
}

export type StripeWebhookHandler<T> = (args: {
  event: Stripe.Event & T;
  revealui: RevealUIInstance;
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

  let revealuiProductID: string | number | undefined;

  // First lookup the product in RevealUI
  try {
    if (logs) revealui.logger.info(`- Looking up existing RevealUI product...`);

    const productQuery = await revealui.find({
      collection: 'products',
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    revealui.logger.error(`Error finding product ${message}`);
  }

  let prices: Awaited<ReturnType<typeof stripe.prices.list>> | undefined;

  try {
    if (logs) revealui.logger.info(`- Looking up all prices associated with this product...`);

    // Find all stripe prices that are assigned to "revealuiProductID"
    prices = await stripe.prices.list({
      product: stripeProductID,
      limit: 100,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    revealui.logger.error(`- Error looking up prices: ${errorMessage}`);
  }

  try {
    if (logs) revealui.logger.info(`- Updating document...`);

    await revealui.update({
      collection: 'products',
      id: revealuiProductID || '',
      data: {
        name: stripeProductName,
        description: stripeDescription,
        priceJSON: JSON.stringify(prices || { data: [], has_more: false }),
        skipSync: true,
      },
    });

    if (logs) revealui.logger.info(`✅ Successfully updated product.`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    revealui.logger.error(`- Error updating product: ${errorMessage}`);
  }
};

interface RequestBody {
  event: Stripe.Event & { data: { object: Stripe.Product } };
  revealui: RevealUIInstance;
  stripe: Stripe;
}

export async function POST(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { event, revealui, stripe } = req.body as RequestBody;

  try {
    await updateProduct({ event, revealui, stripe });
    res.status(200).send('Product updated successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating product', { error: errorMessage });
    res.status(500).send('Internal Server Error');
  }
}
