import { describe, expect, it, vi } from 'vitest';

import {
  createSubscriptionWithIncompleteIntent,
  issueRefund,
  reportAgentOverage,
} from '../stripe-calls.js';
import type { ProtectedStripe } from '../types.js';

/** Stripe live Customer.deleted is `void`; must stay assignable to ProtectedStripe. */
interface StripeLiveCustomer {
  id?: string;
  // biome-ignore lint/suspicious/noConfusingVoidType: mirrors Stripe Customer.deleted
  deleted?: void;
}
type StripeLikeRetrieve = (
  id: string,
) => Promise<StripeLiveCustomer | { id: string; deleted: true }>;
type HostRetrieveAssignable = StripeLikeRetrieve extends ProtectedStripe['customers']['retrieve']
  ? true
  : false;
const hostRetrieveAssignable: HostRetrieveAssignable = true;

/** Stripe Subscription.latest_invoice is `string | Invoice | null`. */
type StripeLikeSubCreate = (params: {
  customer: string;
  items: Array<{ price: string }>;
  payment_behavior: 'default_incomplete';
}) => Promise<{
  id: string;
  status: string;
  latest_invoice: string | { id: string; object: 'invoice' } | null;
}>;
type HostCreateAssignable = StripeLikeSubCreate extends ProtectedStripe['subscriptions']['create']
  ? true
  : false;
const hostCreateAssignable: HostCreateAssignable = true;

function mockStripe(overrides: Partial<ProtectedStripe> = {}): ProtectedStripe {
  return {
    customers: { retrieve: vi.fn(), create: vi.fn() },
    refunds: {
      create: vi.fn().mockResolvedValue({
        id: 're_1',
        amount: 500,
        status: 'succeeded',
        currency: 'usd',
      }),
    },
    billing: {
      meterEvents: { create: vi.fn().mockResolvedValue({}) },
    },
    subscriptions: {
      create: vi.fn(),
    },
    ...overrides,
  };
}

describe('issueRefund', () => {
  it('keeps Stripe Customer.deleted: void assignable to ProtectedStripe', () => {
    expect(hostRetrieveAssignable).toBe(true);
  });

  it('keeps Stripe Invoice latest_invoice assignable to ProtectedStripe', () => {
    expect(hostCreateAssignable).toBe(true);
  });

  it('creates a refund with idempotency key', async () => {
    const stripe = mockStripe();
    const result = await issueRefund(stripe, { paymentIntentId: 'pi_1', amount: 500 });
    expect(result.refundId).toBe('re_1');
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      { payment_intent: 'pi_1', amount: 500 },
      { idempotencyKey: 'refund-pi_1-500' },
    );
  });
});

describe('reportAgentOverage', () => {
  it('skips rows without a customer id', async () => {
    const stripe = mockStripe();
    const out = await reportAgentOverage(stripe, [
      { userId: 'u1', overage: 3, stripeCustomerId: null },
    ]);
    expect(out).toEqual({ reported: 0, skipped: 1 });
    expect(stripe.billing.meterEvents.create).not.toHaveBeenCalled();
  });

  it('reports rows with a customer id', async () => {
    const stripe = mockStripe();
    const cycleStart = new Date(Date.UTC(2026, 0, 1));
    const out = await reportAgentOverage(
      stripe,
      [{ userId: 'u1', overage: 3, stripeCustomerId: 'cus_1' }],
      { cycleStart, meterEventName: 'agent_task_overage' },
    );
    expect(out).toEqual({ reported: 1, skipped: 0 });
    expect(stripe.billing.meterEvents.create).toHaveBeenCalledTimes(1);
  });
});

describe('createSubscriptionWithIncompleteIntent', () => {
  it('returns the first invoice PaymentIntent client_secret', async () => {
    const stripe = mockStripe({
      subscriptions: {
        create: vi.fn().mockResolvedValue({
          id: 'sub_1',
          status: 'incomplete',
          latest_invoice: { payment_intent: { client_secret: 'pi_secret' } },
        }),
      },
    });
    const out = await createSubscriptionWithIncompleteIntent(stripe, {
      customerId: 'cus_1',
      priceId: 'price_1',
    });
    expect(out).toEqual({
      subscriptionId: 'sub_1',
      clientSecret: 'pi_secret',
      status: 'incomplete',
    });
    expect(stripe.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_1',
        payment_behavior: 'default_incomplete',
      }),
      { idempotencyKey: 'incomplete-sub-cus_1-price_1' },
    );
  });
});
