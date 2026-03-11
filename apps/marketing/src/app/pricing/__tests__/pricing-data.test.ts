/**
 * Pricing Data Validation Tests
 *
 * Validates that @revealui/contracts/pricing data used by the pricing page
 * is well-formed. Catches contract changes that would break the marketing site.
 */

import { CREDIT_BUNDLES, PERPETUAL_TIERS, SUBSCRIPTION_TIERS } from '@revealui/contracts/pricing';
import { describe, expect, it } from 'vitest';

describe('Subscription Tiers', () => {
  it('has exactly 4 tiers in correct order', () => {
    expect(SUBSCRIPTION_TIERS).toHaveLength(4);
    expect(SUBSCRIPTION_TIERS.map((t) => t.id)).toEqual(['free', 'pro', 'max', 'enterprise']);
  });

  it('each tier has required structural fields', () => {
    for (const tier of SUBSCRIPTION_TIERS) {
      expect(tier.name).toBeTruthy();
      expect(tier.description).toBeTruthy();
      expect(tier.cta).toBeTruthy();
      expect(tier.ctaHref).toBeTruthy();
      expect(tier.features.length).toBeGreaterThan(0);
    }
  });

  it('price fields are undefined in static arrays (populated at runtime)', () => {
    for (const tier of SUBSCRIPTION_TIERS) {
      expect(tier.price).toBeUndefined();
    }
  });

  it('exactly one tier is highlighted', () => {
    const highlighted = SUBSCRIPTION_TIERS.filter((t) => t.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]?.id).toBe('pro');
  });

  it('free tier CTA links to docs', () => {
    const free = SUBSCRIPTION_TIERS.find((t) => t.id === 'free');
    expect(free?.ctaHref).toContain('docs.revealui.com');
  });

  it('paid tiers link to signup or contact', () => {
    const paid = SUBSCRIPTION_TIERS.filter((t) => t.id !== 'free');
    for (const tier of paid) {
      expect(tier.ctaHref).toMatch(/signup|mailto:/);
    }
  });
});

describe('Credit Bundles', () => {
  it('has 3 bundles', () => {
    expect(CREDIT_BUNDLES).toHaveLength(3);
  });

  it('each bundle has required structural fields', () => {
    for (const bundle of CREDIT_BUNDLES) {
      expect(bundle.name).toBeTruthy();
      expect(bundle.tasks).toBeTruthy();
      expect(bundle.description).toBeTruthy();
    }
  });

  it('exactly one bundle is highlighted', () => {
    const highlighted = CREDIT_BUNDLES.filter((b) => b.highlighted);
    expect(highlighted).toHaveLength(1);
  });
});

describe('Perpetual Tiers', () => {
  it('has 3 tiers', () => {
    expect(PERPETUAL_TIERS).toHaveLength(3);
  });

  it('each tier has required structural fields', () => {
    for (const tier of PERPETUAL_TIERS) {
      expect(tier.name).toBeTruthy();
      expect(tier.description).toBeTruthy();
      expect(tier.features.length).toBeGreaterThan(0);
      expect(tier.cta).toBeTruthy();
      expect(tier.ctaHref).toBeTruthy();
    }
  });
});
