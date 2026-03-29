/**
 * Feature gating system tests — validates tier-based feature flags,
 * individual feature checks, tier progression, and edge cases.
 *
 * Mocks the license module to control the tier returned by isLicensed()
 * and getCurrentTier() without needing real JWT keys.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LicenseTier } from '../license.js';

// ---------------------------------------------------------------------------
// Mock the license module — controls what isLicensed() and getCurrentTier()
// return, allowing us to test features.ts in isolation.
// ---------------------------------------------------------------------------

const mockIsLicensed = vi.fn<(requiredTier: LicenseTier) => boolean>();
const mockGetCurrentTier = vi.fn<() => LicenseTier>();

vi.mock('../license.js', () => ({
  isLicensed: (...args: [LicenseTier]) => mockIsLicensed(...args),
  getCurrentTier: () => mockGetCurrentTier(),
}));

import {
  type FeatureFlags,
  getFeatures,
  getFeaturesForTier,
  getRequiredTier,
  isFeatureEnabled,
} from '../features.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All feature keys defined in FeatureFlags */
const ALL_FEATURES: (keyof FeatureFlags)[] = [
  'aiLocal',
  'ai',
  'aiSampling',
  'aiMemory',
  'mcp',
  'payments',
  'multiTenant',
  'whiteLabel',
  'sso',
  'byokServerSide',
  'aiMultiProvider',
  'auditLog',
  'advancedSync',
  'dashboard',
  'customDomain',
  'analytics',
];

/** Features available at free tier (no license required) */
const FREE_FEATURES: (keyof FeatureFlags)[] = ['aiLocal', 'aiSampling'];

/** Features that require at least Pro tier */
const PRO_FEATURES: (keyof FeatureFlags)[] = [
  'ai',
  'mcp',
  'payments',
  'advancedSync',
  'dashboard',
  'customDomain',
  'analytics',
];

/** Features that require at least Max tier */
const MAX_FEATURES: (keyof FeatureFlags)[] = [
  'aiMemory',
  'byokServerSide',
  'aiMultiProvider',
  'auditLog',
];

/** Features that require Enterprise tier */
const ENTERPRISE_FEATURES: (keyof FeatureFlags)[] = ['multiTenant', 'whiteLabel', 'sso'];

/**
 * Configures the mock to simulate a specific license tier.
 * isLicensed(requiredTier) returns true when the simulated tier rank >= required tier rank.
 */
function simulateTier(tier: LicenseTier): void {
  const tierRank: Record<LicenseTier, number> = {
    free: 0,
    pro: 1,
    max: 2,
    enterprise: 3,
  };

  mockGetCurrentTier.mockReturnValue(tier);
  mockIsLicensed.mockImplementation((requiredTier: LicenseTier) => {
    if (requiredTier === 'free') return true;
    return tierRank[tier] >= tierRank[requiredTier];
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// getFeatures()
// =============================================================================

describe('getFeatures', () => {
  it('returns only aiLocal as true for free tier', () => {
    simulateTier('free');
    const features = getFeatures();

    for (const feature of FREE_FEATURES) {
      expect(features[feature]).toBe(true);
    }
    for (const feature of PRO_FEATURES) {
      expect(features[feature]).toBe(false);
    }
  });

  it('returns pro features as true for pro tier', () => {
    simulateTier('pro');
    const features = getFeatures();

    for (const feature of PRO_FEATURES) {
      expect(features[feature]).toBe(true);
    }
  });

  it('returns max and enterprise features as false for pro tier', () => {
    simulateTier('pro');
    const features = getFeatures();

    for (const feature of MAX_FEATURES) {
      expect(features[feature]).toBe(false);
    }
    for (const feature of ENTERPRISE_FEATURES) {
      expect(features[feature]).toBe(false);
    }
  });

  it('returns pro + max features as true for max tier', () => {
    simulateTier('max');
    const features = getFeatures();

    for (const feature of PRO_FEATURES) {
      expect(features[feature]).toBe(true);
    }
    for (const feature of MAX_FEATURES) {
      expect(features[feature]).toBe(true);
    }
  });

  it('returns enterprise features as false for max tier', () => {
    simulateTier('max');
    const features = getFeatures();

    for (const feature of ENTERPRISE_FEATURES) {
      expect(features[feature]).toBe(false);
    }
  });

  it('returns all features as true for enterprise tier', () => {
    simulateTier('enterprise');
    const features = getFeatures();

    for (const feature of ALL_FEATURES) {
      expect(features[feature]).toBe(true);
    }
  });

  it('returns a FeatureFlags object with exactly 16 keys', () => {
    simulateTier('free');
    const features = getFeatures();
    expect(Object.keys(features)).toHaveLength(16);
  });

  it('calls isLicensed for each feature', () => {
    simulateTier('pro');
    getFeatures();

    // isLicensed should be called once for each feature in the tier map
    expect(mockIsLicensed).toHaveBeenCalledTimes(ALL_FEATURES.length);
  });
});

// =============================================================================
// isFeatureEnabled()
// =============================================================================

describe('isFeatureEnabled', () => {
  describe('free tier — only aiLocal enabled', () => {
    beforeEach(() => simulateTier('free'));

    it.each(FREE_FEATURES)('returns true for %s (free-tier feature)', (feature) => {
      expect(isFeatureEnabled(feature)).toBe(true);
    });

    it.each([
      ...PRO_FEATURES,
      ...MAX_FEATURES,
      ...ENTERPRISE_FEATURES,
    ])('returns false for %s', (feature) => {
      expect(isFeatureEnabled(feature)).toBe(false);
    });
  });

  describe('pro tier — pro features enabled, max/enterprise blocked', () => {
    beforeEach(() => simulateTier('pro'));

    it.each(PRO_FEATURES)('returns true for %s', (feature) => {
      expect(isFeatureEnabled(feature)).toBe(true);
    });

    it.each([...MAX_FEATURES, ...ENTERPRISE_FEATURES])('returns false for %s', (feature) => {
      expect(isFeatureEnabled(feature)).toBe(false);
    });
  });

  describe('max tier — pro + max features enabled, enterprise blocked', () => {
    beforeEach(() => simulateTier('max'));

    it.each([...PRO_FEATURES, ...MAX_FEATURES])('returns true for %s', (feature) => {
      expect(isFeatureEnabled(feature)).toBe(true);
    });

    it.each(ENTERPRISE_FEATURES)('returns false for %s', (feature) => {
      expect(isFeatureEnabled(feature)).toBe(false);
    });
  });

  describe('enterprise tier — all features enabled', () => {
    beforeEach(() => simulateTier('enterprise'));

    it.each(ALL_FEATURES)('returns true for %s', (feature) => {
      expect(isFeatureEnabled(feature)).toBe(true);
    });
  });

  it('delegates to isLicensed with the correct required tier', () => {
    simulateTier('pro');

    isFeatureEnabled('ai');
    expect(mockIsLicensed).toHaveBeenCalledWith('pro');

    mockIsLicensed.mockClear();
    isFeatureEnabled('aiMemory');
    expect(mockIsLicensed).toHaveBeenCalledWith('max');

    mockIsLicensed.mockClear();
    isFeatureEnabled('sso');
    expect(mockIsLicensed).toHaveBeenCalledWith('enterprise');
  });
});

// =============================================================================
// getFeaturesForTier() — pure function, no license state dependency
// =============================================================================

describe('getFeaturesForTier', () => {
  it('returns only aiLocal as true for free tier', () => {
    const features = getFeaturesForTier('free');

    for (const feature of FREE_FEATURES) {
      expect(features[feature]).toBe(true);
    }
    for (const feature of PRO_FEATURES) {
      expect(features[feature]).toBe(false);
    }
  });

  it('returns pro features enabled for pro tier', () => {
    const features = getFeaturesForTier('pro');

    for (const feature of PRO_FEATURES) {
      expect(features[feature]).toBe(true);
    }
    for (const feature of MAX_FEATURES) {
      expect(features[feature]).toBe(false);
    }
    for (const feature of ENTERPRISE_FEATURES) {
      expect(features[feature]).toBe(false);
    }
  });

  it('returns pro + max features enabled for max tier', () => {
    const features = getFeaturesForTier('max');

    for (const feature of PRO_FEATURES) {
      expect(features[feature]).toBe(true);
    }
    for (const feature of MAX_FEATURES) {
      expect(features[feature]).toBe(true);
    }
    for (const feature of ENTERPRISE_FEATURES) {
      expect(features[feature]).toBe(false);
    }
  });

  it('returns all features enabled for enterprise tier', () => {
    const features = getFeaturesForTier('enterprise');

    for (const feature of ALL_FEATURES) {
      expect(features[feature]).toBe(true);
    }
  });

  it('does not call isLicensed (pure computation)', () => {
    getFeaturesForTier('pro');
    expect(mockIsLicensed).not.toHaveBeenCalled();
  });

  it('returns consistent results regardless of current license state', () => {
    // Even when license is free, getFeaturesForTier('enterprise') should show all enabled
    simulateTier('free');
    const enterpriseFeatures = getFeaturesForTier('enterprise');

    for (const feature of ALL_FEATURES) {
      expect(enterpriseFeatures[feature]).toBe(true);
    }
  });
});

// =============================================================================
// getRequiredTier()
// =============================================================================

describe('getRequiredTier', () => {
  it('returns free for aiLocal feature (BitNet)', () => {
    expect(getRequiredTier('aiLocal')).toBe('free');
  });

  it('returns pro for AI feature', () => {
    expect(getRequiredTier('ai')).toBe('pro');
  });

  it('returns pro for MCP feature', () => {
    expect(getRequiredTier('mcp')).toBe('pro');
  });

  it('returns pro for payments feature', () => {
    expect(getRequiredTier('payments')).toBe('pro');
  });

  it('returns pro for advancedSync feature', () => {
    expect(getRequiredTier('advancedSync')).toBe('pro');
  });

  it('returns pro for dashboard feature', () => {
    expect(getRequiredTier('dashboard')).toBe('pro');
  });

  it('returns pro for customDomain feature', () => {
    expect(getRequiredTier('customDomain')).toBe('pro');
  });

  it('returns pro for analytics feature', () => {
    expect(getRequiredTier('analytics')).toBe('pro');
  });

  it('returns max for aiMemory feature', () => {
    expect(getRequiredTier('aiMemory')).toBe('max');
  });

  it('returns max for byokServerSide feature', () => {
    expect(getRequiredTier('byokServerSide')).toBe('max');
  });

  it('returns max for aiMultiProvider feature', () => {
    expect(getRequiredTier('aiMultiProvider')).toBe('max');
  });

  it('returns max for auditLog feature', () => {
    expect(getRequiredTier('auditLog')).toBe('max');
  });

  it('returns enterprise for multiTenant feature', () => {
    expect(getRequiredTier('multiTenant')).toBe('enterprise');
  });

  it('returns enterprise for whiteLabel feature', () => {
    expect(getRequiredTier('whiteLabel')).toBe('enterprise');
  });

  it('returns enterprise for sso feature', () => {
    expect(getRequiredTier('sso')).toBe('enterprise');
  });
});

// =============================================================================
// Tier progression — cumulative unlocking
// =============================================================================

describe('tier progression', () => {
  const tiers: LicenseTier[] = ['free', 'pro', 'max', 'enterprise'];
  const expectedEnabledCounts: Record<LicenseTier, number> = {
    free: 2, // aiLocal + aiSampling
    pro: 9, // 2 free + 7 pro features
    max: 13, // 2 free + 7 pro + 4 max features
    enterprise: 16, // all 16 features
  };

  it.each(tiers)('%s tier enables exactly %i features', (tier) => {
    const features = getFeaturesForTier(tier);
    const enabledCount = Object.values(features).filter(Boolean).length;
    expect(enabledCount).toBe(expectedEnabledCounts[tier]);
  });

  it('each higher tier enables a strict superset of the lower tier', () => {
    for (let i = 0; i < tiers.length - 1; i++) {
      const lower = getFeaturesForTier(tiers[i]);
      const higher = getFeaturesForTier(tiers[i + 1]);

      // Every feature enabled in the lower tier must also be enabled in the higher tier
      for (const feature of ALL_FEATURES) {
        if (lower[feature]) {
          expect(higher[feature]).toBe(true);
        }
      }

      // The higher tier must enable at least one more feature
      const lowerCount = Object.values(lower).filter(Boolean).length;
      const higherCount = Object.values(higher).filter(Boolean).length;
      expect(higherCount).toBeGreaterThan(lowerCount);
    }
  });
});

// =============================================================================
// Feature blocking — free tier cannot access premium features
// =============================================================================

describe('feature blocking — free tier restrictions', () => {
  beforeEach(() => simulateTier('free'));

  it('allows local AI inference (BitNet)', () => {
    expect(isFeatureEnabled('aiLocal')).toBe(true);
  });

  it('blocks cloud AI agent system', () => {
    expect(isFeatureEnabled('ai')).toBe(false);
  });

  it('blocks payment processing', () => {
    expect(isFeatureEnabled('payments')).toBe(false);
  });

  it('blocks multi-tenancy', () => {
    expect(isFeatureEnabled('multiTenant')).toBe(false);
  });

  it('blocks SSO/SAML authentication', () => {
    expect(isFeatureEnabled('sso')).toBe(false);
  });

  it('blocks white-label dashboard', () => {
    expect(isFeatureEnabled('whiteLabel')).toBe(false);
  });

  it('blocks BYOK server-side key storage', () => {
    expect(isFeatureEnabled('byokServerSide')).toBe(false);
  });

  it('blocks audit logging', () => {
    expect(isFeatureEnabled('auditLog')).toBe(false);
  });

  it('blocks MCP server integration', () => {
    expect(isFeatureEnabled('mcp')).toBe(false);
  });

  it('blocks AI memory system', () => {
    expect(isFeatureEnabled('aiMemory')).toBe(false);
  });

  it('blocks multi-provider AI', () => {
    expect(isFeatureEnabled('aiMultiProvider')).toBe(false);
  });

  it('blocks advanced sync', () => {
    expect(isFeatureEnabled('advancedSync')).toBe(false);
  });

  it('blocks monitoring dashboard', () => {
    expect(isFeatureEnabled('dashboard')).toBe(false);
  });

  it('blocks custom domain mapping', () => {
    expect(isFeatureEnabled('customDomain')).toBe(false);
  });

  it('blocks analytics', () => {
    expect(isFeatureEnabled('analytics')).toBe(false);
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe('edge cases', () => {
  it('returns false for gated features when isLicensed always returns false', () => {
    // Simulate a state where no license has been initialized (default = free)
    mockIsLicensed.mockReturnValue(false);
    mockGetCurrentTier.mockReturnValue('free');

    // aiLocal calls isLicensed('free') which returns false in this mock scenario,
    // but in reality isLicensed('free') always returns true. Test the gated features.
    for (const feature of [...PRO_FEATURES, ...MAX_FEATURES, ...ENTERPRISE_FEATURES]) {
      expect(isFeatureEnabled(feature)).toBe(false);
    }
  });

  it('getFeatures returns consistent results across multiple calls', () => {
    simulateTier('pro');
    const first = getFeatures();
    const second = getFeatures();

    for (const feature of ALL_FEATURES) {
      expect(first[feature]).toBe(second[feature]);
    }
  });

  it('isFeatureEnabled and getFeatures agree on each feature', () => {
    simulateTier('max');
    const features = getFeatures();

    for (const feature of ALL_FEATURES) {
      expect(isFeatureEnabled(feature)).toBe(features[feature]);
    }
  });

  it('getFeaturesForTier and getFeatures agree when tier matches', () => {
    // Simulate max tier and verify getFeatures() matches getFeaturesForTier('max')
    simulateTier('max');
    const dynamic = getFeatures();
    const static_ = getFeaturesForTier('max');

    for (const feature of ALL_FEATURES) {
      expect(dynamic[feature]).toBe(static_[feature]);
    }
  });

  it('feature flags object is a plain object with boolean values only', () => {
    simulateTier('enterprise');
    const features = getFeatures();

    for (const [key, value] of Object.entries(features)) {
      expect(typeof key).toBe('string');
      expect(typeof value).toBe('boolean');
    }
  });

  it('each feature in ALL_FEATURES has a corresponding tier mapping', () => {
    // getRequiredTier should not throw for any known feature
    for (const feature of ALL_FEATURES) {
      const tier = getRequiredTier(feature);
      expect(['free', 'pro', 'max', 'enterprise']).toContain(tier);
    }
  });

  it('only aiLocal and aiSampling require free tier — all others are gated', () => {
    const freeTierFeatures: (keyof FeatureFlags)[] = ['aiLocal', 'aiSampling'];
    for (const feature of ALL_FEATURES) {
      if (freeTierFeatures.includes(feature)) {
        expect(getRequiredTier(feature)).toBe('free');
      } else {
        expect(getRequiredTier(feature)).not.toBe('free');
      }
    }
  });
});

// =============================================================================
// getCurrentTier re-export
// =============================================================================

describe('getCurrentTier re-export', () => {
  it('is re-exported from features module', async () => {
    // Dynamic import to verify the re-export exists
    const featuresModule = await import('../features.js');
    expect(featuresModule.getCurrentTier).toBeDefined();
    expect(typeof featuresModule.getCurrentTier).toBe('function');
  });

  it('delegates to the license module getCurrentTier', async () => {
    mockGetCurrentTier.mockReturnValue('max');
    const featuresModule = await import('../features.js');
    const tier = featuresModule.getCurrentTier();
    expect(tier).toBe('max');
    expect(mockGetCurrentTier).toHaveBeenCalled();
  });
});
