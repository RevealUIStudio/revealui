import crypto from 'node:crypto';

export function createWebhookPayload(type: string, data: Record<string, unknown>): string {
  return JSON.stringify({
    id: `evt_test_${Date.now()}`,
    type,
    data: { object: data },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  });
}

export function createValidWebhookSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

export const mockPaymentIntentSucceeded = (overrides?: Record<string, unknown>) => ({
  id: `pi_test_${Date.now()}`,
  object: 'payment_intent',
  amount: 1000,
  currency: 'usd',
  status: 'succeeded',
  customer: 'cus_test123',
  ...overrides,
});

export const mockSubscriptionCreated = (overrides?: Record<string, unknown>) => ({
  id: `sub_test_${Date.now()}`,
  object: 'subscription',
  customer: 'cus_test123',
  status: 'active',
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  ...overrides,
});
