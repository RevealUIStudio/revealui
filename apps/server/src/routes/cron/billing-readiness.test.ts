/**
 * Tests for the billing-readiness cron's Stripe price parity check
 * (CR8-P2-04). Exercises the new section 4 added in this PR.
 *
 * The cron response only surfaces FAILED checks in `body.failures`, so the
 * tests assert:
 *   - parity pass → no `stripe:price:*` entries in `failures`
 *   - parity fail → `stripe:price:<tier>` in `failures` with the detail
 *
 * Covers:
 *   1. Parity pass — Stripe unit_amount matches MRR fallback
 *   2. Parity fail — Stripe unit_amount differs (hard-fail check)
 *   3. Null unit_amount — Stripe returned a free-form / tiered price
 *   4. Stripe lookup error — prices.retrieve throws (deleted / network)
 *   5. Missing env var — tier is skipped (earlier check already flags)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MRR_TIER_PRICE_FALLBACK_CENTS } from '../../lib/tier-pricing.js';

// --- Module mocks ---

const mockRetrieve = vi.fn();

vi.mock('stripe', () => ({
  default: class MockStripe {
    prices = { retrieve: mockRetrieve };
  },
}));

// GAP-131: billing-readiness now uses the protectedStripe wrapper from
// @revealui/services for Stripe price parity checks.
vi.mock('@revealui/services', () => ({
  protectedStripe: {
    prices: { retrieve: mockRetrieve },
  },
}));

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  billingCatalog: { planId: 'plan_id', stripePriceId: 'stripe_price_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => [a, b],
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../lib/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// Billing catalog mock — return rows for every EXPECTED_PLAN_IDS entry so
// section 3 passes cleanly and isn't the source of failures in these tests.
const mockDb = {
  select: vi.fn(() => mockDb),
  from: vi.fn(() =>
    Promise.resolve([
      { planId: 'subscription:pro', stripePriceId: 'price_pro' },
      { planId: 'subscription:max', stripePriceId: 'price_max' },
      { planId: 'subscription:enterprise', stripePriceId: 'price_enterprise' },
      { planId: 'perpetual:pro', stripePriceId: 'price_perp_pro' },
      { planId: 'perpetual:max', stripePriceId: 'price_perp_max' },
      { planId: 'perpetual:enterprise', stripePriceId: 'price_perp_enterprise' },
      { planId: 'credits:starter', stripePriceId: 'price_credits_starter' },
      { planId: 'credits:standard', stripePriceId: 'price_credits_standard' },
      { planId: 'credits:scale', stripePriceId: 'price_credits_scale' },
    ]),
  ),
};

// --- Setup ---

const CRON_SECRET = 'test-cron-secret-long-enough-32chars!';

interface CronBody {
  status: 'ok' | 'failed';
  checkCount: number;
  failureCount: number;
  failures: Array<{ check: string; detail: string }>;
  warningCount: number;
  warnings: Array<{ check: string; detail: string }>;
  checkedAt: string;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockDb.select.mockReturnValue(mockDb);

  process.env.REVEALUI_CRON_SECRET = CRON_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';
  process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'mock_priv_key';
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
  process.env.STRIPE_MAX_PRICE_ID = 'price_max';
  process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_enterprise';

  // Default: every price matches the fallback (parity pass)
  mockRetrieve.mockImplementation((id: string) => {
    const tierMap: Record<string, keyof typeof MRR_TIER_PRICE_FALLBACK_CENTS> = {
      price_pro: 'pro',
      price_max: 'max',
      price_enterprise: 'enterprise',
    };
    const tier = tierMap[id];
    if (!tier) throw new Error(`no mock for ${id}`);
    return Promise.resolve({ id, unit_amount: MRR_TIER_PRICE_FALLBACK_CENTS[tier] });
  });
});

// Dynamic import to respect the env/module mocks above.
async function callCron(): Promise<{ status: number; body: CronBody }> {
  const { default: app } = await import('./billing-readiness.js');
  const res = await app.request('/billing-readiness', {
    method: 'POST',
    headers: { 'X-Cron-Secret': CRON_SECRET },
  });
  return { status: res.status, body: (await res.json()) as CronBody };
}

// --- Tests ---

describe('billing-readiness cron — Stripe price parity (CR8-P2-04)', () => {
  it('parity pass: no stripe:price:* entries in failures', async () => {
    const { body } = await callCron();
    const priceFailures = body.failures.filter((f) => f.check.startsWith('stripe:price:'));
    expect(priceFailures).toHaveLength(0);
  });

  it('parity fail: pro unit_amount drifts → stripe:price:pro in failures', async () => {
    mockRetrieve.mockImplementation((id: string) => {
      if (id === 'price_pro') return Promise.resolve({ id, unit_amount: 5900 }); // drift from 4900
      const tierMap: Record<string, keyof typeof MRR_TIER_PRICE_FALLBACK_CENTS> = {
        price_max: 'max',
        price_enterprise: 'enterprise',
      };
      const tier = tierMap[id];
      return Promise.resolve({ id, unit_amount: MRR_TIER_PRICE_FALLBACK_CENTS[tier!] });
    });

    const { body } = await callCron();
    const pro = body.failures.find((f) => f.check === 'stripe:price:pro');
    expect(pro).toBeDefined();
    expect(pro?.detail).toContain('5900');
    expect(pro?.detail).toContain('4900');
  });

  it('null unit_amount → check fails with tiered-price message', async () => {
    mockRetrieve.mockImplementation((id: string) => {
      if (id === 'price_pro') return Promise.resolve({ id, unit_amount: null });
      const tierMap: Record<string, keyof typeof MRR_TIER_PRICE_FALLBACK_CENTS> = {
        price_max: 'max',
        price_enterprise: 'enterprise',
      };
      const tier = tierMap[id];
      return Promise.resolve({ id, unit_amount: MRR_TIER_PRICE_FALLBACK_CENTS[tier!] });
    });

    const { body } = await callCron();
    const pro = body.failures.find((f) => f.check === 'stripe:price:pro');
    expect(pro).toBeDefined();
    expect(pro?.detail).toMatch(/no unit_amount|tiered|free-form/);
  });

  it('Stripe lookup error → check fails with lookup-failed detail', async () => {
    mockRetrieve.mockImplementation((id: string) => {
      if (id === 'price_max') return Promise.reject(new Error('resource_missing'));
      const tierMap: Record<string, keyof typeof MRR_TIER_PRICE_FALLBACK_CENTS> = {
        price_pro: 'pro',
        price_enterprise: 'enterprise',
      };
      const tier = tierMap[id];
      return Promise.resolve({ id, unit_amount: MRR_TIER_PRICE_FALLBACK_CENTS[tier!] });
    });

    const { body } = await callCron();
    const max = body.failures.find((f) => f.check === 'stripe:price:max');
    expect(max).toBeDefined();
    expect(max?.detail).toContain('lookup failed');
    expect(max?.detail).toContain('resource_missing');
  });

  it('missing env var → parity check skipped; env-var failure still surfaced', async () => {
    delete process.env.STRIPE_ENTERPRISE_PRICE_ID;

    const { body } = await callCron();
    // No stripe:price:enterprise parity entry because we skip when env-var missing.
    const enterpriseParity = body.failures.find((f) => f.check === 'stripe:price:enterprise');
    expect(enterpriseParity).toBeUndefined();
    // But the missing env var IS flagged by section 1.
    const envCheck = body.failures.find((f) => f.check === 'env:STRIPE_ENTERPRISE_PRICE_ID');
    expect(envCheck).toBeDefined();
    expect(envCheck?.detail).toBe('MISSING');
  });
});
