/**
 * Payment intent creation handler
 */

import type { RevealRequest, RevealUIInstance } from '@revealui/core';
import type Stripe from 'stripe';
import { protectedStripe } from './stripeClient.js';

interface CartItem {
  product: {
    stripeProductID: string;
  };
  quantity: number;
}

interface UserWithCart {
  stripeCustomerID?: string;
  name?: string;
  cart?: {
    items: CartItem[];
  };
}

interface CreatePaymentIntentArgs {
  req: RevealRequest;
  res?: Response;
  next?: () => void;
  revealui?: RevealUIInstance;
}

export const createPaymentIntent = async (
  args: CreatePaymentIntentArgs,
): Promise<
  | Response
  | {
      status: number;
      json?: { error: string };
      send?: { client_secret: string | null };
    }
> => {
  const { req } = args;
  const { user, revealui } = req;

  if (!user || typeof user.email !== 'string') {
    return { status: 401, json: { error: 'Unauthorized' } };
  }

  if (!revealui) {
    return { status: 500, json: { error: 'RevealUI instance not available' } };
  }

  const fullUser = await revealui.findByID({
    collection: 'users',
    id: user.id,
  });

  if (!fullUser || typeof fullUser !== 'object') {
    return { status: 404, json: { error: 'User not found' } };
  }

  const typedUser = fullUser as UserWithCart;

  try {
    let stripeCustomerID: string | undefined = typedUser.stripeCustomerID;

    if (!stripeCustomerID) {
      const customerParams: Stripe.CustomerCreateParams = {
        email: user.email,
        name: typeof typedUser.name === 'string' ? typedUser.name : undefined,
      };

      const customer = await protectedStripe.customers.create(customerParams);
      stripeCustomerID = customer.id;

      await revealui.update({
        collection: 'users',
        id: user.id,
        data: {
          stripeCustomerID,
        },
      });
    }

    let total = 0;
    const cart = typedUser.cart;

    if (!(cart && Array.isArray(cart.items)) || cart.items.length === 0) {
      return { status: 400, json: { error: 'No items in cart' } };
    }

    await Promise.allSettled(
      cart.items.map(async (item: CartItem): Promise<void> => {
        const { product, quantity } = item;

        if (
          !quantity ||
          typeof product !== 'object' ||
          typeof product.stripeProductID !== 'string'
        ) {
          throw new Error('Invalid product or quantity');
        }

        const prices = await protectedStripe.prices.list({
          product: product.stripeProductID,
          limit: 100,
        });

        if (prices.data.length === 0) {
          throw new Error('No prices found for product');
        }

        const price = prices.data[0];
        if (price && price.unit_amount !== null && typeof price.unit_amount === 'number') {
          total += price.unit_amount * quantity;
        }
      }),
    );

    if (total === 0) {
      throw new Error('There is nothing to pay for, add some items to your cart and try again.');
    }

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      customer: stripeCustomerID,
      amount: total,
      currency: 'usd',
      payment_method_types: ['card'],
    };

    // 10-minute idempotency window prevents duplicate charges from double-clicks
    // or network retries. Key includes amount so a changed cart creates a new intent.
    const idempotencyWindow = Math.floor(Date.now() / (10 * 60 * 1000));
    const paymentIntent = await protectedStripe.paymentIntents.create(paymentIntentParams, {
      idempotencyKey: `pi-${user.id}-${total}-${idempotencyWindow}`,
    });

    return {
      status: 200,
      send: { client_secret: paymentIntent.client_secret },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const revealuiInstance = revealui;
    if (revealuiInstance?.logger) {
      revealuiInstance.logger.error(message);
    }
    return { status: 500, json: { error: message } };
  }
};
