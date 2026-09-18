import { getFeaturesForTier } from '@revealui/core/features';
import { describe, expect, it } from 'vitest';
import {
  coerceLicenseTier,
  isEnterpriseEquivalentTier,
  isLicensedFeatureUnlocked,
  isUnlimitedOperatorQuota,
  resolveHonestLicenseTier,
} from '../license-honesty';

describe('isUnlimitedOperatorQuota', () => {
  it('treats negative quota as Unlimited (enterprise / operator)', () => {
    expect(isUnlimitedOperatorQuota(-1)).toBe(true);
    expect(isUnlimitedOperatorQuota(Number.NEGATIVE_INFINITY)).toBe(true);
  });

  it('does not treat Free or Pro allotments as Unlimited', () => {
    expect(isUnlimitedOperatorQuota(0)).toBe(false);
    expect(isUnlimitedOperatorQuota(10_000)).toBe(false);
    expect(isUnlimitedOperatorQuota(null)).toBe(false);
    expect(isUnlimitedOperatorQuota(undefined)).toBe(false);
  });
});

describe('isEnterpriseEquivalentTier', () => {
  it('accepts enterprise and the Unlimited label alias', () => {
    expect(isEnterpriseEquivalentTier('enterprise')).toBe(true);
    expect(isEnterpriseEquivalentTier('unlimited')).toBe(true);
  });

  it('rejects commercial-ladder and empty values', () => {
    expect(isEnterpriseEquivalentTier('free')).toBe(false);
    expect(isEnterpriseEquivalentTier('pro')).toBe(false);
    expect(isEnterpriseEquivalentTier('max')).toBe(false);
    expect(isEnterpriseEquivalentTier(null)).toBe(false);
  });
});

describe('coerceLicenseTier', () => {
  it('keeps the commercial ladder and maps Unlimited to enterprise', () => {
    expect(coerceLicenseTier('pro')).toBe('pro');
    expect(coerceLicenseTier('unlimited')).toBe('enterprise');
    expect(coerceLicenseTier('unknown')).toBeNull();
  });
});

describe('resolveHonestLicenseTier', () => {
  it('promotes fleet-operator and Unlimited quota to enterprise', () => {
    expect(resolveHonestLicenseTier({ isFleetOperator: true, subscriptionTier: 'free' })).toBe(
      'enterprise',
    );
    expect(resolveHonestLicenseTier({ subscriptionTier: 'free', usageQuota: -1 })).toBe(
      'enterprise',
    );
  });

  it('keeps an honest Free grant when usage is not Unlimited', () => {
    expect(resolveHonestLicenseTier({ subscriptionTier: 'free', usageQuota: 0 })).toBe('free');
    expect(resolveHonestLicenseTier({ subscriptionTier: 'free' })).toBe('free');
  });

  it('does not downgrade a paid subscription when usage is missing', () => {
    expect(resolveHonestLicenseTier({ subscriptionTier: 'pro' })).toBe('pro');
    expect(resolveHonestLicenseTier({ subscriptionTier: 'max', usageQuota: 50_000 })).toBe('max');
  });
});

describe('isLicensedFeatureUnlocked — agents / tasks / KG (feature ai)', () => {
  it('unlocks AI for fleet-operator and Unlimited/enterprise even with a missing features map', () => {
    expect(
      isLicensedFeatureUnlocked({
        feature: 'ai',
        features: null,
        tier: 'enterprise',
      }),
    ).toBe(true);
    expect(
      isLicensedFeatureUnlocked({
        feature: 'ai',
        features: { ai: false },
        tier: 'unlimited',
      }),
    ).toBe(true);
    expect(
      isLicensedFeatureUnlocked({
        feature: 'ai',
        features: null,
        isFleetOperator: true,
      }),
    ).toBe(true);
    expect(getFeaturesForTier('enterprise').ai).toBe(true);
  });

  it('keeps Free honestly locked for /agents even when aiLocal is on', () => {
    expect(
      isLicensedFeatureUnlocked({
        feature: 'ai',
        features: { ai: false, aiLocal: true },
        tier: 'free',
      }),
    ).toBe(false);
    expect(
      isLicensedFeatureUnlocked({
        feature: 'aiLocal',
        features: { ai: false, aiLocal: true },
        tier: 'free',
      }),
    ).toBe(true);
  });

  it('unlocks from the Pro feature map without treating the user as an operator', () => {
    expect(
      isLicensedFeatureUnlocked({
        feature: 'ai',
        features: { ai: true },
        tier: 'pro',
      }),
    ).toBe(true);
  });
});
