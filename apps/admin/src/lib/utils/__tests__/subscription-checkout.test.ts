import { afterEach, describe, expect, it } from 'vitest';
import { subscriptionCheckoutBody } from '../subscription-checkout';

describe('subscriptionCheckoutBody', () => {
  const originalPro = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
  const originalMax = process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID;

  afterEach(() => {
    if (originalPro === undefined) {
      delete process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
    } else {
      process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID = originalPro;
    }
    if (originalMax === undefined) {
      delete process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID;
    } else {
      process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID = originalMax;
    }
  });

  it('posts only the catalog tier so the server billing catalog resolves the price', () => {
    const body = subscriptionCheckoutBody('pro');
    expect(body).toEqual({ tier: 'pro' });
    expect(body).not.toHaveProperty('priceId');
  });

  it('never forwards a client-baked NEXT_PUBLIC Stripe price id', () => {
    process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID = 'price_wrong_client_bake';
    process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID = 'price_wrong_max_bake';
    expect(subscriptionCheckoutBody('pro')).toEqual({ tier: 'pro' });
    expect(subscriptionCheckoutBody('max')).toEqual({ tier: 'max' });
  });
});
