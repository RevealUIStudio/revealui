/**
 * Pricing Marketing Drift Tests (marketing-overhaul Phase 2.6)
 *
 * Canonical price map lives in `docs/MARKETING_METRICS.md` §2 — this test
 * asserts the server-side fallback prices in `apps/server/src/routes/pricing.ts`
 * match it exactly. When a price changes, ALL of these must update in lockstep:
 *
 *   1. `apps/server/src/routes/pricing.ts` HARDCODED_*_PRICES
 *   2. `apps/marketing/app/content/pricing.ts` + dependent content
 *   3. `apps/marketing/app/lib/pricing-fallbacks.ts` SUBSCRIPTION/PERPETUAL_PRICE_FALLBACKS
 *   4. `apps/marketing/app/routes/PricingPage.tsx` (imports from #3)
 *   5. `apps/marketing/app/components/landing/PricingTeaser.tsx` (imports from #3)
 *   6. `apps/server/src/lib/tier-pricing.ts` MRR_TIER_PRICE_FALLBACK_USD
 *   7. `docs/MARKETING_METRICS.md` §2 (the canonical doc)
 *   8. Stripe live data (via `pnpm stripe:seed` post-update)
 *   9. This file
 *
 * If this test fails, the lockstep was broken. Don't update the test in
 * isolation — update all nine surfaces together so the canonical truth stays canonical.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Stripe to be unavailable so the fallback path runs.
const { mockProductsList } = vi.hoisted(() => ({ mockProductsList: vi.fn() }));
vi.mock('stripe', () => ({
  default: class MockStripe {
    products = { list: mockProductsList };
  },
}));
vi.mock('@revealui/services', () => ({
  protectedStripe: { products: { list: mockProductsList } },
}));

// Always trip the circuit-breaker so the fallback fires deterministically.
vi.mock('@revealui/core/error-handling', () => ({
  CircuitBreaker: class {
    async execute<T>(_fn: () => Promise<T>): Promise<T> {
      throw new CircuitBreakerOpenErrorStub();
    }
  },
  CircuitBreakerOpenError: class CircuitBreakerOpenErrorStub extends Error {},
}));
class CircuitBreakerOpenErrorStub extends Error {}

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { MRR_TIER_PRICE_FALLBACK_USD } from '../../lib/tier-pricing.js';
import app from '../pricing.js';

// ---------------------------------------------------------------------------
// Canonical price map — sourced from docs/MARKETING_METRICS.md §2 (2026-05-18).
// When this map changes, update all six surfaces listed in the file header.
// ---------------------------------------------------------------------------

const CANONICAL_SUBSCRIPTION_PRICES = {
  free: { price: '$0', period: undefined },
  pro: { price: '$49', period: '/month' },
  max: { price: '$299', period: '/month' },
  enterprise: { price: undefined, period: undefined },
} as const;

const CANONICAL_PERPETUAL_PRICES = {
  'Pro Perpetual': {
    price: '$1,499',
    priceNote: 'one-time',
    renewal: '$149/yr for continued support',
  },
} as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pricing Marketing Drift — fallback prices match docs/MARKETING_METRICS.md §2', () => {
  beforeEach(() => {
    mockProductsList.mockReset();
    mockProductsList.mockResolvedValue({ data: [] });
  });

  it('subscription fallback prices match canonical map exactly', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.subscriptions).toBeDefined();
    expect(Array.isArray(body.subscriptions)).toBe(true);
    expect(body.subscriptions.length).toBe(Object.keys(CANONICAL_SUBSCRIPTION_PRICES).length);

    for (const tier of body.subscriptions) {
      const canonical =
        CANONICAL_SUBSCRIPTION_PRICES[tier.id as keyof typeof CANONICAL_SUBSCRIPTION_PRICES];
      expect(
        canonical,
        `Subscription tier ${tier.id} not present in canonical map; add or remove the tier and update docs/MARKETING_METRICS.md §2`,
      ).toBeDefined();
      expect(tier.price, `Subscription tier ${tier.id} price drift`).toBe(canonical.price);
      if (canonical.period === undefined) {
        // Free tier — period may be absent OR present as a falsy string. Both OK.
        expect(tier.period ?? null, `Free tier should have no period`).toBeFalsy();
      } else {
        expect(tier.period, `Subscription tier ${tier.id} period drift`).toBe(canonical.period);
      }
    }
  });

  it('does not publish credit packs on the public catalog', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.credits).toEqual([]);
    const json = JSON.stringify(body);
    expect(json.includes('$10')).toBe(false);
    expect(json.includes('$50')).toBe(false);
    expect(json.includes('$250')).toBe(false);
  });

  it('MRR_TIER_PRICE_FALLBACK_USD matches canonical subscription prices', () => {
    expect(MRR_TIER_PRICE_FALLBACK_USD.pro, 'MRR pro price drift').toBe(49);
    expect(MRR_TIER_PRICE_FALLBACK_USD.max, 'MRR max price drift').toBe(299);
    expect(MRR_TIER_PRICE_FALLBACK_USD.enterprise, 'MRR enterprise price drift').toBe(1499);
  });

  it('annual subscription prices absent from response when env guards unset', async () => {
    // No STRIPE_*_ANNUAL_PRICE_ID env vars set by default in test environment.
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();

    for (const tier of body.subscriptions) {
      expect(
        tier.annualPrice,
        `Tier ${tier.id} should NOT expose annualPrice when env guard is absent`,
      ).toBeUndefined();
    }
  });

  it('annual subscription prices present when env guards set', async () => {
    vi.stubEnv('STRIPE_PRO_ANNUAL_PRICE_ID', 'price_test_pro_annual');
    vi.stubEnv('STRIPE_MAX_ANNUAL_PRICE_ID', 'price_test_max_annual');
    vi.stubEnv('STRIPE_ENTERPRISE_ANNUAL_PRICE_ID', 'price_test_enterprise_annual');

    try {
      const res = await app.request('/');
      expect(res.status).toBe(200);
      const body = await res.json();

      const ANNUAL_PRICES: Record<string, { annualPrice: string; annualPeriod: string }> = {
        pro: { annualPrice: '$470', annualPeriod: '/year' },
        max: { annualPrice: '$2,870', annualPeriod: '/year' },
      };

      for (const tier of body.subscriptions) {
        if (tier.id === 'enterprise') {
          expect(tier.annualPrice, 'Enterprise stays inquire-only').toBeUndefined();
          expect(tier.annualPeriod, 'Enterprise stays inquire-only').toBeUndefined();
          continue;
        }
        const expected = ANNUAL_PRICES[tier.id];
        if (!expected) continue; // free tier — no annual price
        expect(tier.annualPrice, `Tier ${tier.id} annualPrice`).toBe(expected.annualPrice);
        expect(tier.annualPeriod, `Tier ${tier.id} annualPeriod`).toBe(expected.annualPeriod);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('perpetual-tier fallback prices match canonical map exactly', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.perpetual).toBeDefined();
    expect(Array.isArray(body.perpetual)).toBe(true);
    expect(body.perpetual.length).toBe(Object.keys(CANONICAL_PERPETUAL_PRICES).length);

    for (const tier of body.perpetual) {
      const canonical =
        CANONICAL_PERPETUAL_PRICES[tier.name as keyof typeof CANONICAL_PERPETUAL_PRICES];
      expect(
        canonical,
        `Perpetual tier ${tier.name} not present in canonical map; add or remove the tier and update docs/MARKETING_METRICS.md §2`,
      ).toBeDefined();
      expect(tier.price, `Perpetual tier ${tier.name} price drift`).toBe(canonical.price);
      expect(tier.priceNote, `Perpetual tier ${tier.name} priceNote drift`).toBe(
        canonical.priceNote,
      );
      expect(tier.renewal, `Perpetual tier ${tier.name} renewal drift`).toBe(canonical.renewal);
    }
  });
});
