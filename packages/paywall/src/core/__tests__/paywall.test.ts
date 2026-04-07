import { describe, expect, it } from 'vitest';

import { DEFAULT_FEATURES, DEFAULT_LIMITS, DEFAULT_TIERS } from '../defaults.js';
import { createPaywall } from '../paywall.js';

describe('createPaywall — zero-config (defaults)', () => {
  const paywall = createPaywall();

  it('uses default tiers', () => {
    expect(paywall.tiers).toEqual(DEFAULT_TIERS);
  });

  it('default tier is free', () => {
    expect(paywall.defaultTier).toBe('free');
  });

  it('exposes config with all defaults', () => {
    expect(paywall.config.tiers).toEqual(DEFAULT_TIERS);
    expect(paywall.config.features).toEqual(DEFAULT_FEATURES);
    expect(paywall.config.limits).toEqual(DEFAULT_LIMITS);
  });

  describe('isLicensed', () => {
    it('same tier is licensed', () => {
      expect(paywall.isLicensed('pro', 'pro')).toBe(true);
    });

    it('higher tier is licensed for lower requirement', () => {
      expect(paywall.isLicensed('enterprise', 'free')).toBe(true);
    });

    it('lower tier is not licensed for higher requirement', () => {
      expect(paywall.isLicensed('free', 'pro')).toBe(false);
    });
  });

  describe('isFeatureEnabled', () => {
    it('free tier gets aiLocal', () => {
      expect(paywall.isFeatureEnabled('free', 'aiLocal')).toBe(true);
    });

    it('free tier does not get ai', () => {
      expect(paywall.isFeatureEnabled('free', 'ai')).toBe(false);
    });

    it('pro tier gets ai and payments', () => {
      expect(paywall.isFeatureEnabled('pro', 'ai')).toBe(true);
      expect(paywall.isFeatureEnabled('pro', 'payments')).toBe(true);
    });

    it('max tier gets aiMemory', () => {
      expect(paywall.isFeatureEnabled('max', 'aiMemory')).toBe(true);
    });

    it('pro tier does not get aiMemory', () => {
      expect(paywall.isFeatureEnabled('pro', 'aiMemory')).toBe(false);
    });

    it('enterprise gets everything except planned', () => {
      expect(paywall.isFeatureEnabled('enterprise', 'ai')).toBe(true);
      expect(paywall.isFeatureEnabled('enterprise', 'multiTenant')).toBe(true);
      expect(paywall.isFeatureEnabled('enterprise', 'whiteLabel')).toBe(false); // planned
      expect(paywall.isFeatureEnabled('enterprise', 'sso')).toBe(false); // planned
    });
  });

  describe('getFeaturesForTier', () => {
    it('returns boolean map for free tier', () => {
      const flags = paywall.getFeaturesForTier('free');
      expect(flags.aiLocal).toBe(true);
      expect(flags.ai).toBe(false);
      expect(flags.payments).toBe(false);
    });

    it('pro tier enables all pro-level features', () => {
      const flags = paywall.getFeaturesForTier('pro');
      expect(flags.aiLocal).toBe(true);
      expect(flags.ai).toBe(true);
      expect(flags.mcp).toBe(true);
      expect(flags.payments).toBe(true);
      expect(flags.analytics).toBe(true);
      expect(flags.customDomain).toBe(true);
      expect(flags.dashboard).toBe(true);
      expect(flags.advancedSync).toBe(true);
      expect(flags.vaultDesktop).toBe(true);
      expect(flags.vaultRotation).toBe(true);
      expect(flags.aiMemory).toBe(false);
      expect(flags.devkitProfiles).toBe(false);
    });
  });

  describe('getRequiredTier', () => {
    it('returns the tier for known features', () => {
      expect(paywall.getRequiredTier('ai')).toBe('pro');
      expect(paywall.getRequiredTier('aiMemory')).toBe('max');
      expect(paywall.getRequiredTier('multiTenant')).toBe('enterprise');
    });

    it('returns undefined for unknown features', () => {
      expect(paywall.getRequiredTier('nonexistent')).toBeUndefined();
    });
  });

  describe('getFeatureLabel', () => {
    it('returns the label for known features', () => {
      expect(paywall.getFeatureLabel('ai')).toBe('AI Agents');
    });

    it('falls back to feature name for unknowns', () => {
      expect(paywall.getFeatureLabel('mystery')).toBe('mystery');
    });
  });

  describe('getLimit', () => {
    it('returns default limits', () => {
      expect(paywall.getLimit('sites', 'free')).toBe(1);
      expect(paywall.getLimit('sites', 'pro')).toBe(5);
      expect(paywall.getLimit('sites', 'max')).toBe(15);
      expect(paywall.getLimit('sites', 'enterprise')).toBe(Infinity);
    });

    it('returns Infinity for unknown resources', () => {
      expect(paywall.getLimit('unknown', 'pro')).toBe(Infinity);
    });
  });

  describe('isOverLimit', () => {
    it('free tier limited to 1 site', () => {
      expect(paywall.isOverLimit('sites', 'free', 0)).toBe(false);
      expect(paywall.isOverLimit('sites', 'free', 1)).toBe(true);
    });

    it('enterprise is never over limit', () => {
      expect(paywall.isOverLimit('sites', 'enterprise', 999_999)).toBe(false);
    });
  });

  describe('checkFeature', () => {
    it('returns null when allowed', () => {
      expect(paywall.checkFeature('pro', 'ai')).toBeNull();
    });

    it('returns denial when not allowed', () => {
      const denial = paywall.checkFeature('free', 'ai');
      expect(denial).not.toBeNull();
      expect(denial?.feature).toBe('ai');
      expect(denial?.requiredTier).toBe('pro');
      expect(denial?.currentTier).toBe('free');
      expect(denial?.message).toContain('AI Agents');
      expect(denial?.message).toContain('pro');
    });

    it('denial for unknown feature uses feature name as label', () => {
      const denial = paywall.checkFeature('free', 'mystery');
      expect(denial).not.toBeNull();
      expect(denial?.message).toContain('mystery');
      expect(denial?.requiredTier).toBe('unknown');
    });
  });

  describe('checkTier', () => {
    it('returns null when tier meets requirement', () => {
      expect(paywall.checkTier('pro', 'pro')).toBeNull();
      expect(paywall.checkTier('enterprise', 'free')).toBeNull();
    });

    it('returns denial when tier is too low', () => {
      const denial = paywall.checkTier('free', 'pro');
      expect(denial).not.toBeNull();
      expect(denial?.requiredTier).toBe('pro');
      expect(denial?.currentTier).toBe('free');
      expect(denial?.message).toContain('pro');
    });
  });
});

describe('createPaywall — custom config', () => {
  const paywall = createPaywall({
    tiers: ['starter', 'growth', 'scale'] as const,
    features: {
      apiAccess: { tier: 'starter', label: 'API Access' },
      teamMembers: { tier: 'growth', label: 'Team Members' },
      whiteLabel: { tier: 'scale', label: 'White Label' },
    },
    limits: {
      seats: { starter: 1, growth: 10, scale: Infinity },
    },
  });

  it('uses custom tiers', () => {
    expect(paywall.tiers).toEqual(['starter', 'growth', 'scale']);
  });

  it('default tier is the first custom tier', () => {
    expect(paywall.defaultTier).toBe('starter');
  });

  it('feature gating works with custom tiers', () => {
    expect(paywall.isFeatureEnabled('starter', 'apiAccess')).toBe(true);
    expect(paywall.isFeatureEnabled('starter', 'teamMembers')).toBe(false);
    expect(paywall.isFeatureEnabled('growth', 'teamMembers')).toBe(true);
    expect(paywall.isFeatureEnabled('growth', 'whiteLabel')).toBe(false);
    expect(paywall.isFeatureEnabled('scale', 'whiteLabel')).toBe(true);
  });

  it('limits work with custom tiers', () => {
    expect(paywall.getLimit('seats', 'starter')).toBe(1);
    expect(paywall.getLimit('seats', 'growth')).toBe(10);
    expect(paywall.getLimit('seats', 'scale')).toBe(Infinity);
  });

  it('checkFeature uses custom labels', () => {
    const denial = paywall.checkFeature('starter', 'teamMembers');
    expect(denial?.message).toContain('Team Members');
    expect(denial?.requiredTier).toBe('growth');
  });
});

describe('createPaywall — partial override', () => {
  it('overrides only the specified parts, keeps rest as defaults', () => {
    const paywall = createPaywall({
      limits: {
        seats: { free: 2, pro: 50, max: 200, enterprise: Infinity },
      },
    });

    // Default tiers and features are preserved
    expect(paywall.tiers).toEqual(DEFAULT_TIERS);
    expect(paywall.isFeatureEnabled('pro', 'ai')).toBe(true);

    // Custom limits are applied
    expect(paywall.getLimit('seats', 'free')).toBe(2);
    expect(paywall.getLimit('seats', 'pro')).toBe(50);

    // Default limits (sites, users, tasksPerMonth) are NOT present since we overrode the whole limits object
    expect(paywall.getLimit('sites', 'free')).toBe(Infinity);
  });
});
