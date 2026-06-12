/**
 * Drift gate: asserts that the shared client-side fallback constants exported from
 * apps/marketing/app/lib/pricing-fallbacks.ts match the canonical values in
 * .jv/business/offerings-canonical.md (pinned 2026-06-07).
 *
 * When prices change, update ALL surfaces listed in pricing-fallbacks.ts header
 * and keep this test in lockstep.
 */
import { describe, expect, it } from 'vitest';
import { PERPETUAL_PRICE_FALLBACKS, SUBSCRIPTION_PRICE_FALLBACKS } from '../lib/pricing-fallbacks';

describe('pricing-fallbacks — canonical value assertions', () => {
  it('subscription fallbacks match canonical prices', () => {
    expect(SUBSCRIPTION_PRICE_FALLBACKS.free.price).toBe('$0');
    expect(SUBSCRIPTION_PRICE_FALLBACKS.pro.price).toBe('$49');
    expect(SUBSCRIPTION_PRICE_FALLBACKS.pro.period).toBe('/month');
    expect(SUBSCRIPTION_PRICE_FALLBACKS.max.price).toBe('$299');
    expect(SUBSCRIPTION_PRICE_FALLBACKS.max.period).toBe('/month');
    expect(SUBSCRIPTION_PRICE_FALLBACKS.enterprise.price).toBe('$1,499');
    expect(SUBSCRIPTION_PRICE_FALLBACKS.enterprise.period).toBe('/month');
  });

  it('perpetual fallbacks match canonical prices', () => {
    expect(PERPETUAL_PRICE_FALLBACKS['Pro Perpetual'].price).toBe('$1,499');
    expect(PERPETUAL_PRICE_FALLBACKS['Pro Perpetual'].renewal).toBe(
      '$149/yr for continued support',
    );
    expect(PERPETUAL_PRICE_FALLBACKS['Agency Perpetual'].price).toBe('$8,499');
    expect(PERPETUAL_PRICE_FALLBACKS['Agency Perpetual'].renewal).toBe(
      '$799/yr for continued support',
    );
    expect(PERPETUAL_PRICE_FALLBACKS['Enterprise Perpetual'].price).toBe('$42,999');
    expect(PERPETUAL_PRICE_FALLBACKS['Enterprise Perpetual'].renewal).toBe(
      '$3,999/yr for continued support',
    );
  });

  it('covers all four subscription tiers', () => {
    const ids = Object.keys(SUBSCRIPTION_PRICE_FALLBACKS);
    expect(ids).toEqual(expect.arrayContaining(['free', 'pro', 'max', 'enterprise']));
    expect(ids).toHaveLength(4);
  });

  it('covers all three perpetual tiers', () => {
    const names = Object.keys(PERPETUAL_PRICE_FALLBACKS);
    expect(names).toEqual(
      expect.arrayContaining(['Pro Perpetual', 'Agency Perpetual', 'Enterprise Perpetual']),
    );
    expect(names).toHaveLength(3);
  });
});
