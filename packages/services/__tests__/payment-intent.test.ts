/**
 * Tests for createPaymentIntent (src/stripe/payment-intent.ts).
 *
 * Covers auth/validation guards, customer lifecycle, cart pricing,
 * idempotency-key shape, and error handling. `protectedStripe` is mocked
 * at the stripeClient module boundary; `revealui` + `req` are constructed
 * inline (no real Stripe keys or DB needed).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockStripe } = vi.hoisted(() => ({
  mockStripe: {
    customers: { create: vi.fn() },
    prices: { list: vi.fn() },
    paymentIntents: { create: vi.fn() },
  },
}));

vi.mock('../src/stripe/stripeClient.js', () => ({ protectedStripe: mockStripe }));

import { createPaymentIntent } from '../src/stripe/payment-intent.js';

interface MockReveal {
  findByID: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  logger: { error: ReturnType<typeof vi.fn> };
}

function makeRevealui(): MockReveal {
  return {
    findByID: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    logger: { error: vi.fn() },
  };
}

function makeArgs(opts: {
  user?: { id: string; email?: unknown } | null;
  revealui?: MockReveal | null;
}): Parameters<typeof createPaymentIntent>[0] {
  return {
    req: { user: opts.user, revealui: opts.revealui },
  } as unknown as Parameters<typeof createPaymentIntent>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createPaymentIntent', () => {
  it('returns 401 when there is no user', async () => {
    const res = await createPaymentIntent(makeArgs({ user: null, revealui: makeRevealui() }));
    expect(res).toEqual({ status: 401, json: { error: 'Unauthorized' } });
  });

  it('returns 401 when user.email is not a string', async () => {
    const res = await createPaymentIntent(
      makeArgs({ user: { id: 'u1', email: 123 }, revealui: makeRevealui() }),
    );
    expect(res).toEqual({ status: 401, json: { error: 'Unauthorized' } });
  });

  it('returns 500 when the revealui instance is missing', async () => {
    const res = await createPaymentIntent(
      makeArgs({ user: { id: 'u1', email: 'a@b.com' }, revealui: null }),
    );
    expect(res).toEqual({ status: 500, json: { error: 'RevealUI instance not available' } });
  });

  it('returns 404 when the user record is not found', async () => {
    const revealui = makeRevealui();
    revealui.findByID.mockResolvedValue(null);
    const res = await createPaymentIntent(
      makeArgs({ user: { id: 'u1', email: 'a@b.com' }, revealui }),
    );
    expect(res).toEqual({ status: 404, json: { error: 'User not found' } });
  });

  it('creates a Stripe customer when the user has none, then proceeds to 200', async () => {
    const revealui = makeRevealui();
    revealui.findByID.mockResolvedValue({
      cart: { items: [{ product: { stripeProductID: 'prod_1' }, quantity: 2 }] },
      name: 'Ada',
    });
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });
    mockStripe.prices.list.mockResolvedValue({ data: [{ unit_amount: 500 }] });
    mockStripe.paymentIntents.create.mockResolvedValue({ client_secret: 'cs_123' });

    const res = await createPaymentIntent(
      makeArgs({ user: { id: 'u1', email: 'a@b.com' }, revealui }),
    );

    expect(mockStripe.customers.create).toHaveBeenCalledWith({ email: 'a@b.com', name: 'Ada' });
    expect(revealui.update).toHaveBeenCalledWith({
      collection: 'users',
      id: 'u1',
      data: { stripeCustomerID: 'cus_new' },
    });
    expect(res).toEqual({ status: 200, send: { client_secret: 'cs_123' } });
  });

  it('skips customer creation when stripeCustomerID already exists', async () => {
    const revealui = makeRevealui();
    revealui.findByID.mockResolvedValue({
      stripeCustomerID: 'cus_existing',
      cart: { items: [{ product: { stripeProductID: 'prod_1' }, quantity: 1 }] },
    });
    mockStripe.prices.list.mockResolvedValue({ data: [{ unit_amount: 1000 }] });
    mockStripe.paymentIntents.create.mockResolvedValue({ client_secret: 'cs_x' });

    const res = await createPaymentIntent(
      makeArgs({ user: { id: 'u1', email: 'a@b.com' }, revealui }),
    );

    expect(mockStripe.customers.create).not.toHaveBeenCalled();
    expect(res).toEqual({ status: 200, send: { client_secret: 'cs_x' } });
  });

  it('returns 400 when the cart is empty', async () => {
    const revealui = makeRevealui();
    revealui.findByID.mockResolvedValue({ stripeCustomerID: 'cus_1', cart: { items: [] } });
    const res = await createPaymentIntent(
      makeArgs({ user: { id: 'u1', email: 'a@b.com' }, revealui }),
    );
    expect(res).toEqual({ status: 400, json: { error: 'No items in cart' } });
  });

  it('returns 400 when there is no cart at all', async () => {
    const revealui = makeRevealui();
    revealui.findByID.mockResolvedValue({ stripeCustomerID: 'cus_1' });
    const res = await createPaymentIntent(
      makeArgs({ user: { id: 'u1', email: 'a@b.com' }, revealui }),
    );
    expect(res).toEqual({ status: 400, json: { error: 'No items in cart' } });
  });

  it('returns 400 for an invalid product or quantity in the cart', async () => {
    const revealui = makeRevealui();
    revealui.findByID.mockResolvedValue({
      stripeCustomerID: 'cus_1',
      cart: { items: [{ product: {}, quantity: 0 }] },
    });
    const res = await createPaymentIntent(
      makeArgs({ user: { id: 'u1', email: 'a@b.com' }, revealui }),
    );
    expect(res).toEqual({ status: 400, json: { error: 'Invalid product or quantity in cart' } });
  });

  it('returns 400 when no price exists for a product', async () => {
    const revealui = makeRevealui();
    revealui.findByID.mockResolvedValue({
      stripeCustomerID: 'cus_1',
      cart: { items: [{ product: { stripeProductID: 'prod_1' }, quantity: 1 }] },
    });
    mockStripe.prices.list.mockResolvedValue({ data: [] });
    const res = await createPaymentIntent(
      makeArgs({ user: { id: 'u1', email: 'a@b.com' }, revealui }),
    );
    expect(res).toEqual({
      status: 400,
      json: { error: 'No price found for a product in your cart' },
    });
  });

  it('returns 500 (caught throw) when the computed total is zero', async () => {
    const revealui = makeRevealui();
    revealui.findByID.mockResolvedValue({
      stripeCustomerID: 'cus_1',
      cart: { items: [{ product: { stripeProductID: 'prod_1' }, quantity: 1 }] },
    });
    mockStripe.prices.list.mockResolvedValue({ data: [{ unit_amount: null }] });
    const res = await createPaymentIntent(
      makeArgs({ user: { id: 'u1', email: 'a@b.com' }, revealui }),
    );
    expect(res).toEqual({
      status: 500,
      json: { error: 'Payment processing failed. Please try again.' },
    });
    expect(revealui.logger.error).toHaveBeenCalled();
  });

  it('passes a stable idempotency key and correct amount to paymentIntents.create', async () => {
    const revealui = makeRevealui();
    revealui.findByID.mockResolvedValue({
      stripeCustomerID: 'cus_1',
      cart: { items: [{ product: { stripeProductID: 'prod_1' }, quantity: 3 }] },
    });
    mockStripe.prices.list.mockResolvedValue({ data: [{ unit_amount: 200 }] });
    mockStripe.paymentIntents.create.mockResolvedValue({ client_secret: 'cs_y' });

    await createPaymentIntent(makeArgs({ user: { id: 'u9', email: 'a@b.com' }, revealui }));

    const call = mockStripe.paymentIntents.create.mock.calls[0];
    expect(call[0]).toMatchObject({
      customer: 'cus_1',
      amount: 600,
      currency: 'usd',
      payment_method_types: ['card'],
    });
    expect(call[1].idempotencyKey).toContain('pi-u9-600-');
  });

  it('returns 500 and logs when Stripe payment intent creation throws', async () => {
    const revealui = makeRevealui();
    revealui.findByID.mockResolvedValue({
      stripeCustomerID: 'cus_1',
      cart: { items: [{ product: { stripeProductID: 'prod_1' }, quantity: 1 }] },
    });
    mockStripe.prices.list.mockResolvedValue({ data: [{ unit_amount: 1500 }] });
    mockStripe.paymentIntents.create.mockRejectedValue(new Error('Stripe down'));

    const res = await createPaymentIntent(
      makeArgs({ user: { id: 'u1', email: 'a@b.com' }, revealui }),
    );
    expect(res).toEqual({
      status: 500,
      json: { error: 'Payment processing failed. Please try again.' },
    });
    expect(revealui.logger.error).toHaveBeenCalledWith('Stripe down');
  });
});
