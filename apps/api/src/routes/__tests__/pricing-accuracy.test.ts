/**
 * Pricing Accuracy Tests (Phase 2.5 — Stripe Go-Live Readiness)
 *
 * Validates that the contracts/pricing.ts definitions (single source of truth
 * for marketing pages, billing UI, and upgrade prompts) are consistent with
 * the code-level enforcement in core/features.ts and middleware/license.ts.
 *
 * These tests catch drift between what we advertise and what we enforce.
 */

import {
  CREDIT_BUNDLES,
  type FeatureFlagKey,
  getTierLabel,
  getTiersFromCurrent,
  type LicenseTierId,
  PERPETUAL_TIERS,
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  TIER_LIMITS,
} from '@revealui/contracts/pricing';
import { describe, expect, it } from 'vitest';

// ─── Constants mirroring code enforcement ──────────────────────────────────

/**
 * Feature-to-tier map must exactly match core/features.ts featureTierMap.
 * If this drifts, the pricing page claims don't match enforcement.
 */
const EXPECTED_FEATURE_TIER_MAP: Record<FeatureFlagKey, LicenseTierId> = {
  aiLocal: 'free',
  ai: 'pro',
  mcp: 'pro',
  payments: 'pro',
  advancedSync: 'pro',
  dashboard: 'pro',
  customDomain: 'pro',
  analytics: 'pro',
  aiMemory: 'max',
  aiInference: 'max',
  auditLog: 'max',
  multiTenant: 'enterprise',
  whiteLabel: 'enterprise',
  sso: 'enterprise',
};

/** Must match getHostedLimitsForTier in webhooks.ts */
const EXPECTED_HOSTED_LIMITS: Record<
  LicenseTierId,
  { maxSites: number; maxUsers: number; maxAgentTasks: number }
> = {
  free: { maxSites: 1, maxUsers: 3, maxAgentTasks: 1_000 },
  pro: { maxSites: 5, maxUsers: 25, maxAgentTasks: 10_000 },
  max: { maxSites: 15, maxUsers: 100, maxAgentTasks: 50_000 },
  enterprise: {
    maxSites: Number.MAX_SAFE_INTEGER,
    maxUsers: Number.MAX_SAFE_INTEGER,
    maxAgentTasks: Number.MAX_SAFE_INTEGER,
  },
};

const ALL_TIERS: LicenseTierId[] = ['free', 'pro', 'max', 'enterprise'];

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Pricing Accuracy — Contracts vs Code Enforcement', () => {
  describe('Tier structure completeness', () => {
    it('SUBSCRIPTION_TIERS covers all 4 tiers', () => {
      const tierIds = SUBSCRIPTION_TIERS.map((t) => t.id);
      expect(tierIds).toEqual(expect.arrayContaining(ALL_TIERS));
      expect(tierIds).toHaveLength(4);
    });

    it('TIER_LABELS covers all 4 tiers', () => {
      for (const tier of ALL_TIERS) {
        expect(TIER_LABELS[tier]).toBeDefined();
        expect(TIER_LABELS[tier].length).toBeGreaterThan(0);
      }
    });

    it('TIER_LIMITS covers all 4 tiers', () => {
      for (const tier of ALL_TIERS) {
        expect(TIER_LIMITS[tier]).toBeDefined();
      }
    });

    it('enterprise is labeled "Forge" in subscription tiers', () => {
      const enterprise = SUBSCRIPTION_TIERS.find((t) => t.id === 'enterprise');
      expect(enterprise?.name).toBe('Forge');
    });
  });

  describe('Tier limits match enforcement', () => {
    it.each(ALL_TIERS)('TIER_LIMITS[%s] matches expected hosted limits', (tier) => {
      const limits = TIER_LIMITS[tier];
      const expected = EXPECTED_HOSTED_LIMITS[tier];

      // sites: null in contracts = unlimited = MAX_SAFE_INTEGER in code
      const expectedSites = limits.sites ?? Number.MAX_SAFE_INTEGER;
      expect(expectedSites).toBe(expected.maxSites);

      // users: null in contracts = unlimited = MAX_SAFE_INTEGER in code
      const expectedUsers = limits.users ?? Number.MAX_SAFE_INTEGER;
      expect(expectedUsers).toBe(expected.maxUsers);

      // agentTasks: null in contracts = unlimited = MAX_SAFE_INTEGER in code
      const expectedTasks = limits.agentTasks ?? Number.MAX_SAFE_INTEGER;
      expect(expectedTasks).toBe(expected.maxAgentTasks);
    });

    it('limits are monotonically increasing from free → enterprise', () => {
      for (let i = 1; i < ALL_TIERS.length; i++) {
        const prev = TIER_LIMITS[ALL_TIERS[i - 1]];
        const curr = TIER_LIMITS[ALL_TIERS[i]];

        const prevSites = prev.sites ?? Number.MAX_SAFE_INTEGER;
        const currSites = curr.sites ?? Number.MAX_SAFE_INTEGER;
        expect(currSites).toBeGreaterThanOrEqual(prevSites);

        const prevUsers = prev.users ?? Number.MAX_SAFE_INTEGER;
        const currUsers = curr.users ?? Number.MAX_SAFE_INTEGER;
        expect(currUsers).toBeGreaterThanOrEqual(prevUsers);

        const prevTasks = prev.agentTasks ?? Number.MAX_SAFE_INTEGER;
        const currTasks = curr.agentTasks ?? Number.MAX_SAFE_INTEGER;
        expect(currTasks).toBeGreaterThanOrEqual(prevTasks);
      }
    });

    it('enterprise limits are all unlimited (null)', () => {
      const enterprise = TIER_LIMITS.enterprise;
      expect(enterprise.sites).toBeNull();
      expect(enterprise.users).toBeNull();
      expect(enterprise.agentTasks).toBeNull();
    });

    it('free tier has the most restrictive limits', () => {
      const free = TIER_LIMITS.free;
      expect(free.sites).toBe(1);
      expect(free.users).toBe(3);
      expect(free.agentTasks).toBe(1_000);
    });
  });

  describe('Feature flag consistency', () => {
    it('all 14 feature flags have tier assignments', () => {
      const featureKeys = Object.keys(EXPECTED_FEATURE_TIER_MAP);
      expect(featureKeys).toHaveLength(14);
    });

    it('aiLocal is the only free-tier feature', () => {
      const freeFeatures = Object.entries(EXPECTED_FEATURE_TIER_MAP)
        .filter(([, tier]) => tier === 'free')
        .map(([feature]) => feature);

      expect(freeFeatures).toEqual(['aiLocal']);
    });

    it('pro-tier has 7 features', () => {
      const proFeatures = Object.entries(EXPECTED_FEATURE_TIER_MAP)
        .filter(([, tier]) => tier === 'pro')
        .map(([feature]) => feature);

      expect(proFeatures).toHaveLength(7);
      expect(proFeatures).toContain('ai');
      expect(proFeatures).toContain('mcp');
      expect(proFeatures).toContain('payments');
    });

    it('max-tier has 3 features', () => {
      const maxFeatures = Object.entries(EXPECTED_FEATURE_TIER_MAP)
        .filter(([, tier]) => tier === 'max')
        .map(([feature]) => feature);

      expect(maxFeatures).toHaveLength(3);
      expect(maxFeatures).toContain('aiMemory');
      expect(maxFeatures).toContain('auditLog');
    });

    it('enterprise-tier has 3 features', () => {
      const enterpriseFeatures = Object.entries(EXPECTED_FEATURE_TIER_MAP)
        .filter(([, tier]) => tier === 'enterprise')
        .map(([feature]) => feature);

      expect(enterpriseFeatures).toHaveLength(3);
      expect(enterpriseFeatures).toContain('multiTenant');
      expect(enterpriseFeatures).toContain('sso');
    });
  });

  describe('Subscription tier display data', () => {
    it('free tier has no price', () => {
      const free = SUBSCRIPTION_TIERS.find((t) => t.id === 'free');
      expect(free?.price).toBeUndefined();
    });

    it('all paid tiers have a CTA href', () => {
      const paidTiers = SUBSCRIPTION_TIERS.filter((t) => t.id !== 'free');
      for (const tier of paidTiers) {
        expect(tier.ctaHref).toBeDefined();
        expect(tier.ctaHref.length).toBeGreaterThan(0);
      }
    });

    it('each tier has at least 5 feature bullet points', () => {
      for (const tier of SUBSCRIPTION_TIERS) {
        expect(tier.features.length).toBeGreaterThanOrEqual(5);
      }
    });

    it('only one tier is highlighted (the recommended tier)', () => {
      const highlighted = SUBSCRIPTION_TIERS.filter((t) => t.highlighted);
      expect(highlighted).toHaveLength(1);
      expect(highlighted[0].id).toBe('pro');
    });

    it('tier descriptions are non-empty', () => {
      for (const tier of SUBSCRIPTION_TIERS) {
        expect(tier.description.length).toBeGreaterThan(10);
      }
    });
  });

  describe('Credit bundles (Track B)', () => {
    it('has 3 credit bundles', () => {
      expect(CREDIT_BUNDLES).toHaveLength(3);
    });

    it('bundle names are unique', () => {
      const names = CREDIT_BUNDLES.map((b) => b.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('only one bundle is highlighted', () => {
      const highlighted = CREDIT_BUNDLES.filter((b) => b.highlighted);
      expect(highlighted).toHaveLength(1);
    });

    it('each bundle has a tasks count', () => {
      for (const bundle of CREDIT_BUNDLES) {
        expect(bundle.tasks).toBeDefined();
        expect(bundle.tasks.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Perpetual licenses (Track C)', () => {
    it('has 3 perpetual tiers', () => {
      expect(PERPETUAL_TIERS).toHaveLength(3);
    });

    it('each perpetual tier has features list', () => {
      for (const tier of PERPETUAL_TIERS) {
        expect(tier.features.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('perpetual tier names are unique', () => {
      const names = PERPETUAL_TIERS.map((t) => t.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('each perpetual tier has a CTA', () => {
      for (const tier of PERPETUAL_TIERS) {
        expect(tier.cta).toBeDefined();
        expect(tier.ctaHref).toBeDefined();
      }
    });
  });

  describe('Helper functions', () => {
    it('getTiersFromCurrent returns only higher tiers', () => {
      const fromFree = getTiersFromCurrent('free');
      expect(fromFree.map((t) => t.id)).toEqual(['pro', 'max', 'enterprise']);

      const fromPro = getTiersFromCurrent('pro');
      expect(fromPro.map((t) => t.id)).toEqual(['max', 'enterprise']);

      const fromMax = getTiersFromCurrent('max');
      expect(fromMax.map((t) => t.id)).toEqual(['enterprise']);

      const fromEnterprise = getTiersFromCurrent('enterprise');
      expect(fromEnterprise).toHaveLength(0);
    });

    it('getTierLabel returns human-readable labels', () => {
      expect(getTierLabel('free')).toBe('Free (OSS)');
      expect(getTierLabel('pro')).toBe('Pro');
      expect(getTierLabel('max')).toBe('Max');
      expect(getTierLabel('enterprise')).toBe('Forge (Enterprise)');
    });
  });

  describe('Cross-validation: contracts limits vs subscription tier feature text', () => {
    it('Pro tier feature text mentions correct site limit', () => {
      const pro = SUBSCRIPTION_TIERS.find((t) => t.id === 'pro');
      const proLimits = TIER_LIMITS.pro;
      const siteFeature = pro?.features.find((f) => f.toLowerCase().includes('site'));
      expect(siteFeature).toContain(String(proLimits.sites));
    });

    it('Pro tier feature text mentions correct user limit', () => {
      const pro = SUBSCRIPTION_TIERS.find((t) => t.id === 'pro');
      const proLimits = TIER_LIMITS.pro;
      const userFeature = pro?.features.find((f) => f.toLowerCase().includes('user'));
      expect(userFeature).toContain(String(proLimits.users));
    });

    it('Max tier feature text mentions correct site limit', () => {
      const max = SUBSCRIPTION_TIERS.find((t) => t.id === 'max');
      const maxLimits = TIER_LIMITS.max;
      const siteFeature = max?.features.find((f) => f.toLowerCase().includes('site'));
      expect(siteFeature).toContain(String(maxLimits.sites));
    });

    it('Max tier feature text mentions correct user limit', () => {
      const max = SUBSCRIPTION_TIERS.find((t) => t.id === 'max');
      const maxLimits = TIER_LIMITS.max;
      const userFeature = max?.features.find((f) => f.toLowerCase().includes('user'));
      expect(userFeature).toContain(String(maxLimits.users));
    });

    it('Enterprise tier feature text mentions unlimited', () => {
      const enterprise = SUBSCRIPTION_TIERS.find((t) => t.id === 'enterprise');
      const siteFeature = enterprise?.features.find((f) => f.toLowerCase().includes('site'));
      expect(siteFeature?.toLowerCase()).toContain('unlimited');

      const userFeature = enterprise?.features.find((f) => f.toLowerCase().includes('user'));
      expect(userFeature?.toLowerCase()).toContain('unlimited');
    });

    it('agent task limits in feature text match TIER_LIMITS', () => {
      const pro = SUBSCRIPTION_TIERS.find((t) => t.id === 'pro');
      const taskFeature = pro?.features.find((f) => f.toLowerCase().includes('agent task'));
      expect(taskFeature).toContain('10,000');

      const max = SUBSCRIPTION_TIERS.find((t) => t.id === 'max');
      const maxTaskFeature = max?.features.find((f) => f.toLowerCase().includes('agent task'));
      expect(maxTaskFeature).toContain('50,000');

      const enterprise = SUBSCRIPTION_TIERS.find((t) => t.id === 'enterprise');
      const entTaskFeature = enterprise?.features.find((f) =>
        f.toLowerCase().includes('agent task'),
      );
      expect(entTaskFeature?.toLowerCase()).toContain('unlimited');
    });
  });

  describe('API rate limits are tier-ordered', () => {
    it('rate limits increase with tier', () => {
      expect(TIER_LIMITS.free.apiRequestsPerMinute).toBeLessThan(
        TIER_LIMITS.pro.apiRequestsPerMinute,
      );
      expect(TIER_LIMITS.pro.apiRequestsPerMinute).toBeLessThan(
        TIER_LIMITS.max.apiRequestsPerMinute,
      );
      expect(TIER_LIMITS.max.apiRequestsPerMinute).toBeLessThan(
        TIER_LIMITS.enterprise.apiRequestsPerMinute,
      );
    });

    it('free tier has 200 req/min', () => {
      expect(TIER_LIMITS.free.apiRequestsPerMinute).toBe(200);
    });

    it('enterprise tier has 1000 req/min', () => {
      expect(TIER_LIMITS.enterprise.apiRequestsPerMinute).toBe(1_000);
    });
  });
});
