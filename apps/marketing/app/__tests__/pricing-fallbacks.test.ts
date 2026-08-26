/**
 * Drift gate: asserts that the shared client-side fallback constants exported from
 * apps/marketing/app/lib/pricing-fallbacks.ts match the canonical values in
 * .jv/business/offerings-canonical.md (pinned 2026-06-07).
 *
 * When prices change, update ALL surfaces listed in pricing-fallbacks.ts header
 * and keep this test in lockstep.
 */
import { describe, expect, it } from 'vitest';
import {
  ANNUAL_SUBSCRIPTION_PRICE_FALLBACKS,
  PERPETUAL_PRICE_FALLBACKS,
  SUBSCRIPTION_PRICE_FALLBACKS,
} from '../lib/pricing-fallbacks';

describe('pricing-fallbacks — canonical value assertions', () => {
  it('subscription fallbacks match canonical prices', () => {
    expect(SUBSCRIPTION_PRICE_FALLBACKS.free.price).toBe('$0');
    expect(SUBSCRIPTION_PRICE_FALLBACKS.pro.price).toBe('$49');
    expect(SUBSCRIPTION_PRICE_FALLBACKS.pro.period).toBe('/month');
    expect(SUBSCRIPTION_PRICE_FALLBACKS.max.price).toBe('$299');
    expect(SUBSCRIPTION_PRICE_FALLBACKS.max.period).toBe('/month');
    expect(SUBSCRIPTION_PRICE_FALLBACKS.enterprise.price).toBe('Contact sales');
    expect(SUBSCRIPTION_PRICE_FALLBACKS.enterprise.period).toBeUndefined();
  });

  it('perpetual fallbacks match public catalog prices', () => {
    expect(PERPETUAL_PRICE_FALLBACKS).toMatchObject({
      'Pro Perpetual': { price: '$1,499', renewal: '$149/yr for continued support' },
    });
    expect(PERPETUAL_PRICE_FALLBACKS['Agency Perpetual']).toBeUndefined();
    expect(PERPETUAL_PRICE_FALLBACKS['Enterprise Perpetual']).toBeUndefined();
  });

  it('does not publish leftover Enterprise monthly $1,499 or Agency $8,499', () => {
    const blob = JSON.stringify({
      ...SUBSCRIPTION_PRICE_FALLBACKS,
      ...ANNUAL_SUBSCRIPTION_PRICE_FALLBACKS,
      ...PERPETUAL_PRICE_FALLBACKS,
    });
    expect(blob.includes('$1,499/month') || blob.includes('$1499/month')).toBe(false);
    expect(blob.includes('$8,499') || blob.includes('$8499')).toBe(false);
    expect(SUBSCRIPTION_PRICE_FALLBACKS.enterprise.period).not.toBe('/month');
  });

  it('covers all four subscription tiers', () => {
    const ids = Object.keys(SUBSCRIPTION_PRICE_FALLBACKS);
    expect(ids).toEqual(expect.arrayContaining(['free', 'pro', 'max', 'enterprise']));
    expect(ids).toHaveLength(4);
  });

  it('covers the public perpetual catalog only', () => {
    const names = Object.keys(PERPETUAL_PRICE_FALLBACKS);
    expect(names).toEqual(['Pro Perpetual']);
    expect(names.includes('Agency Perpetual')).toBe(false);
    expect(names.includes('Enterprise Perpetual')).toBe(false);
  });

  it('keeps annual prices and does not invent leftover savings sublines', () => {
    expect(ANNUAL_SUBSCRIPTION_PRICE_FALLBACKS.pro.price).toBe('$470');
    expect(ANNUAL_SUBSCRIPTION_PRICE_FALLBACKS.max.price).toBe('$2,870');
    expect(JSON.stringify(ANNUAL_SUBSCRIPTION_PRICE_FALLBACKS).includes('$118')).toBe(false);
    expect(JSON.stringify(ANNUAL_SUBSCRIPTION_PRICE_FALLBACKS).includes('$718')).toBe(false);
  });
});
