import { getTiersFromCurrent, SUBSCRIPTION_TIERS } from '@revealui/contracts/pricing';
import { describe, expect, it } from 'vitest';
import {
  LICENSE_SUBSCRIPTION_PRICE_FALLBACKS,
  mergeLicenseSubscriptionPrices,
} from '../license-subscription-prices';

describe('LICENSE_SUBSCRIPTION_PRICE_FALLBACKS', () => {
  it('keeps the Pro license price at $49/mo', () => {
    expect(LICENSE_SUBSCRIPTION_PRICE_FALLBACKS.pro.price).toBe('$49');
    expect(LICENSE_SUBSCRIPTION_PRICE_FALLBACKS.pro.period).toBe('/mo');
  });

  it('covers only license subscription ids', () => {
    expect(Object.keys(LICENSE_SUBSCRIPTION_PRICE_FALLBACKS)).toEqual([
      'free',
      'pro',
      'max',
      'enterprise',
    ]);
  });
});

describe('mergeLicenseSubscriptionPrices', () => {
  it('fills Pro $49 from fallbacks when the licenses catalog is missing', () => {
    const merged = mergeLicenseSubscriptionPrices(getTiersFromCurrent('free'), null);
    const pro = merged.find((tier) => tier.id === 'pro');
    expect(pro?.price).toBe('$49');
    expect(pro?.period).toBe('/mo');
    expect(`${pro?.price}${pro?.period}`).toBe('$49/mo');
  });

  it('prefers live licenses-catalog prices over fallbacks', () => {
    const proTier = SUBSCRIPTION_TIERS.find((tier) => tier.id === 'pro');
    expect(proTier).toBeDefined();
    if (!proTier) return;
    const merged = mergeLicenseSubscriptionPrices(SUBSCRIPTION_TIERS, {
      subscriptions: [{ ...proTier, price: '$49', period: '/month' }],
    });
    const pro = merged.find((tier) => tier.id === 'pro');
    expect(pro?.price).toBe('$49');
    expect(pro?.period).toBe('/month');
  });

  it('never leaves a dash placeholder on license tiers', () => {
    const merged = mergeLicenseSubscriptionPrices(getTiersFromCurrent('free'), undefined);
    for (const tier of merged) {
      expect(tier.price).toBeTruthy();
      expect(tier.price).not.toBe('-');
    }
  });
});
