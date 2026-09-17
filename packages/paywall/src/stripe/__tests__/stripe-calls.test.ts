import { describe, expect, it, vi } from 'vitest';

import { issueRefund, reportAgentOverage } from '../stripe-calls.js';
import type { ProtectedStripe } from '../types.js';

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
    ...overrides,
  };
}

describe('issueRefund', () => {
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
