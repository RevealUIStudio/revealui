import { logger } from '@revealui/core/utils/logger';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type Stripe from 'stripe';

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
    data: { priceJSON: string; skipSync: boolean };
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

const logs = false;

export const updatePrice: StripeWebhookHandler<{
  data: {
    object: Stripe.Price;
  };
}> = async (args) => {
  const { event, revealui, stripe } = args;

  const priceObject = event.data.object;
  if (
    typeof priceObject !== 'object' ||
    priceObject === null ||
    !('product' in priceObject) ||
    !('id' in priceObject)
  ) {
    revealui.logger.error('Invalid price object in Stripe event');
    return;
  }

  const stripeProduct = priceObject.product;
  const stripeProductID = typeof stripeProduct === 'string' ? stripeProduct : stripeProduct.id;

  if (logs)
    revealui.logger.info(
      `🪝 A price was created or updated in Stripe on product ID: ${stripeProductID}, syncing to RevealUI...`,
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
          `- Found existing product with Stripe ID: ${stripeProductID}, saving price...`,
        );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    revealui.logger.error(`Error finding product ${msg}`);
  }

  try {
    // Find all stripe prices that are assigned to "revealuiProductID"
    const stripePrices = await stripe.prices.list({
      product: stripeProductID,
      limit: 100,
    });

    await revealui.update({
      collection: 'products',
      id: revealuiProductID || '',
      data: {
        priceJSON: JSON.stringify(stripePrices),
        skipSync: true,
      },
    });

    if (logs) revealui.logger.info(`✅ Successfully updated product price.`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    revealui.logger.error(`- Error updating product price: ${errorMessage}`);
  }
};

interface RequestBody {
  event: Stripe.Event & { data: { object: Stripe.Price } };
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
    await updatePrice({ event, revealui, stripe });
    res.status(200).send('Product updated successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating product', { error: errorMessage });
    res.status(500).send('Internal Server Error');
  }
}
