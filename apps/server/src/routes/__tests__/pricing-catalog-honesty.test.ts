/**
 * Public catalog honesty for GET /api/pricing.
 *
 * Live /pricing already hides Agency $8,499 and treats Enterprise as
 * inquire-only (no $1,499/mo). The JSON catalog must match that — leftover
 * SKUs must not leak from fallbacks or Stripe product merge.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockProductsList } = vi.hoisted(() => ({ mockProductsList: vi.fn() }));

vi.mock('stripe', () => ({
  default: class MockStripe {
    products = { list: mockProductsList };
  },
}));

vi.mock('@revealui/services', () => ({
  protectedStripe: { products: { list: mockProductsList } },
}));

vi.mock('@revealui/core/error-handling', () => ({
  CircuitBreaker: class {
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    }
  },
  CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {},
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import app from '../pricing.js';

interface PricingBody {
  subscriptions: Array<{
    id: string;
    name: string;
    price?: string;
    period?: string;
    annualPrice?: string;
    annualPeriod?: string;
    cta: string;
    ctaHref: string;
  }>;
  perpetual: Array<{
    name: string;
    price?: string;
    priceNote?: string;
    cta: string;
    ctaHref: string;
  }>;
}

function jsonHasAgency8499(body: unknown): boolean {
  const json = JSON.stringify(body);
  return json.includes('$8,499') || json.includes('$8499');
}

function jsonHasEnterpriseMonthly1499(body: unknown): boolean {
  const json = JSON.stringify(body);
  return (
    json.includes('$1,499/month') ||
    json.includes('$1499/month') ||
    json.includes('$1,499/mo') ||
    json.includes('$1499/mo')
  );
}

function assertPublicCatalogHonesty(body: PricingBody): void {
  expect(jsonHasAgency8499(body), 'catalog must not publish Agency $8,499 / $8499').toBe(false);
  expect(
    jsonHasEnterpriseMonthly1499(body),
    'catalog must not publish Enterprise $1,499/mo as a buyable monthly price',
  ).toBe(false);

  const enterprise = body.subscriptions.find((tier) => tier.id === 'enterprise');
  expect(enterprise, 'Enterprise remains a public license / inquire entry').toBeDefined();
  expect(enterprise?.cta).toBe('Contact sales');
  expect(enterprise?.ctaHref.includes('signup')).toBe(false);
  expect(enterprise?.price).toBeUndefined();
  expect(enterprise?.period).toBeUndefined();
  expect(enterprise?.annualPrice).toBeUndefined();
  expect(enterprise?.annualPeriod).toBeUndefined();

  const agency = body.perpetual.find((tier) => tier.name === 'Agency Perpetual');
  expect(agency, 'Agency must not appear as a public catalog SKU').toBeUndefined();
}

describe('GET /api/pricing — public catalog honesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockProductsList.mockResolvedValue({ data: [] });
  });

  it('fallback catalog has no Agency $8,499 and no Enterprise monthly $1,499', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as PricingBody;
    assertPublicCatalogHonesty(body);
  });

  it('does not publish leftover SKUs even when Stripe returns them', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_dummy');
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Enterprise',
          metadata: { revealui_track: 'subscription', revealui_tier: 'enterprise' },
          default_price: { unit_amount: 149900, recurring: { interval: 'month' } },
        },
        {
          name: 'Agency Perpetual',
          metadata: {
            revealui_track: 'perpetual',
            revealui_tier: 'agency_perpetual',
            revealui_price_note: 'one-time',
          },
          default_price: { unit_amount: 849900 },
        },
        {
          name: 'Pro',
          metadata: { revealui_track: 'subscription', revealui_tier: 'pro' },
          default_price: { unit_amount: 4900, recurring: { interval: 'month' } },
        },
      ],
    });

    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as PricingBody;
    assertPublicCatalogHonesty(body);

    const pro = body.subscriptions.find((tier) => tier.id === 'pro');
    expect(pro?.price).toBe('$49');
    expect(pro?.period).toBe('/month');
  });

  it('keeps Enterprise inquire-only when the annual price-ID guard is set', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    vi.stubEnv('STRIPE_ENTERPRISE_ANNUAL_PRICE_ID', 'price_test_enterprise_annual');
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as PricingBody;
    assertPublicCatalogHonesty(body);
  });
});
