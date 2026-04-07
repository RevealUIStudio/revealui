import { describe, expect, it } from 'vitest';

import {
  getFeatureLabel,
  getFeaturesForTier,
  getRequiredTier,
  isFeatureEnabled,
} from '../features.js';
import { buildTierRanks } from '../tiers.js';
import type { FeatureDefinition } from '../types.js';

const tiers = ['free', 'pro', 'max', 'enterprise'] as const;
type Tier = (typeof tiers)[number];
const ranks = buildTierRanks(tiers);

const features: Record<string, FeatureDefinition<Tier>> = {
  basic: { tier: 'free', label: 'Basic Feature' },
  ai: { tier: 'pro', label: 'AI Agents' },
  memory: { tier: 'max', label: 'AI Memory' },
  sso: { tier: 'enterprise', label: 'SSO / SAML' },
  planned: { tier: 'pro', label: 'Future Feature', planned: true },
};

describe('isFeatureEnabled', () => {
  it('free tier can access free features', () => {
    expect(isFeatureEnabled(ranks, features, 'free', 'basic')).toBe(true);
  });

  it('free tier cannot access pro features', () => {
    expect(isFeatureEnabled(ranks, features, 'free', 'ai')).toBe(false);
  });

  it('pro tier can access free and pro features', () => {
    expect(isFeatureEnabled(ranks, features, 'pro', 'basic')).toBe(true);
    expect(isFeatureEnabled(ranks, features, 'pro', 'ai')).toBe(true);
  });

  it('pro tier cannot access max features', () => {
    expect(isFeatureEnabled(ranks, features, 'pro', 'memory')).toBe(false);
  });

  it('enterprise tier can access all features', () => {
    expect(isFeatureEnabled(ranks, features, 'enterprise', 'basic')).toBe(true);
    expect(isFeatureEnabled(ranks, features, 'enterprise', 'ai')).toBe(true);
    expect(isFeatureEnabled(ranks, features, 'enterprise', 'memory')).toBe(true);
    expect(isFeatureEnabled(ranks, features, 'enterprise', 'sso')).toBe(true);
  });

  it('planned features are always disabled', () => {
    expect(isFeatureEnabled(ranks, features, 'enterprise', 'planned')).toBe(false);
  });

  it('unknown features return false', () => {
    expect(isFeatureEnabled(ranks, features, 'enterprise', 'nonexistent')).toBe(false);
  });

  it('unknown tier returns false', () => {
    expect(isFeatureEnabled(ranks, features, 'unknown' as Tier, 'basic')).toBe(false);
  });
});

describe('getFeaturesForTier', () => {
  it('free tier gets only free features', () => {
    const flags = getFeaturesForTier(ranks, features, 'free');
    expect(flags).toEqual({
      basic: true,
      ai: false,
      memory: false,
      sso: false,
      planned: false,
    });
  });

  it('pro tier gets free and pro features', () => {
    const flags = getFeaturesForTier(ranks, features, 'pro');
    expect(flags).toEqual({
      basic: true,
      ai: true,
      memory: false,
      sso: false,
      planned: false,
    });
  });

  it('enterprise tier gets all non-planned features', () => {
    const flags = getFeaturesForTier(ranks, features, 'enterprise');
    expect(flags).toEqual({
      basic: true,
      ai: true,
      memory: true,
      sso: true,
      planned: false,
    });
  });
});

describe('getRequiredTier', () => {
  it('returns the required tier for known features', () => {
    expect(getRequiredTier(features, 'ai')).toBe('pro');
    expect(getRequiredTier(features, 'sso')).toBe('enterprise');
  });

  it('returns undefined for unknown features', () => {
    expect(getRequiredTier(features, 'nonexistent')).toBeUndefined();
  });
});

describe('getFeatureLabel', () => {
  it('returns the label for known features', () => {
    expect(getFeatureLabel(features, 'ai')).toBe('AI Agents');
    expect(getFeatureLabel(features, 'sso')).toBe('SSO / SAML');
  });

  it('returns the feature name as fallback for unknown features', () => {
    expect(getFeatureLabel(features, 'nonexistent')).toBe('nonexistent');
  });
});
