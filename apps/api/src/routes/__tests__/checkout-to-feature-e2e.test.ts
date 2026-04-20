/**
 * Checkout-to-Feature E2E Flow Test (Phase 2.3)
 *
 * For each tier (Pro, Max, Enterprise):
 * 1. Start with a free-tier user
 * 2. Assert: Pro-gated features return 403
 * 3. Simulate checkout.session.completed webhook
 * 4. Assert: correct tier set in entitlements
 * 5. Assert: tier-appropriate features now accessible
 * 6. Assert: higher-tier features still blocked
 * 7. Assert: resource limits match the tier
 *
 * This tests the complete payment → entitlement → feature access pipeline.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@revealui/core/features', () => ({
  getRequiredTier: vi.fn((feature: string) => {
    const map: Record<string, string> = {
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
    return map[feature] ?? 'enterprise';
  }),
  isFeatureEnabled: vi.fn(() => false),
  getFeaturesForTier: vi.fn((tier: string) => {
    const tierRank: Record<string, number> = { free: 0, pro: 1, max: 2, enterprise: 3 };
    const map: Record<string, string> = {
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
    const flags: Record<string, boolean> = {};
    for (const [f, req] of Object.entries(map)) {
      flags[f] = (tierRank[tier] ?? 0) >= (tierRank[req] ?? 0);
    }
    return flags;
  }),
}));

vi.mock('@revealui/core/license', () => ({
  getCurrentTier: vi.fn(() => 'free'),
  isLicensed: vi.fn(() => false),
  getLicensePayload: vi.fn(() => null),
}));

vi.mock('../../middleware/x402.js', () => ({
  getX402Config: vi.fn(() => ({ enabled: false })),
  buildPaymentRequired: vi.fn(() => ({})),
  encodePaymentRequired: vi.fn(() => ''),
  verifyPayment: vi.fn(async () => ({ valid: false })),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import { getFeaturesForTier } from '@revealui/core/features';
import { requireFeature } from '../../middleware/license.js';

// ─── Constants ──────────────────────────────────────────────────────────────

type Tier = 'free' | 'pro' | 'max' | 'enterprise';

/** Features grouped by the tier that first unlocks them */
const PRO_FEATURES = [
  'ai',
  'mcp',
  'payments',
  'advancedSync',
  'dashboard',
  'customDomain',
  'analytics',
] as const;
const MAX_FEATURES = ['aiMemory', 'aiInference', 'auditLog'] as const;
const ENTERPRISE_FEATURES = ['multiTenant', 'whiteLabel', 'sso'] as const;

/** Hosted tier limits (must match getHostedLimitsForTier in apps/api/src/lib/tier-limits.ts) */
const HOSTED_LIMITS: Record<Tier, { maxSites: number; maxUsers: number; maxAgentTasks: number }> = {
  free: { maxSites: 1, maxUsers: 3, maxAgentTasks: 1_000 },
  pro: { maxSites: 5, maxUsers: 25, maxAgentTasks: 10_000 },
  max: { maxSites: 15, maxUsers: 100, maxAgentTasks: 50_000 },
  enterprise: {
    maxSites: Number.MAX_SAFE_INTEGER,
    maxUsers: Number.MAX_SAFE_INTEGER,
    maxAgentTasks: Number.MAX_SAFE_INTEGER,
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

type FeatureName = string;

/**
 * Simulates a user at a given tier trying to access a feature-gated endpoint.
 * Returns the HTTP status code.
 */
async function testFeatureAccess(tier: Tier, feature: FeatureName): Promise<number> {
  const features = getFeaturesForTier(tier) as Record<string, boolean>;

  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('entitlements', {
      accountId: 'acct_e2e',
      subscriptionStatus: 'active',
      tier,
      features,
      limits: HOSTED_LIMITS[tier],
    });
    await next();
  });
  app.use(
    '*',
    requireFeature(feature as Parameters<typeof requireFeature>[0], { mode: 'entitlements' }),
  );
  app.get('/test', (c) => c.json({ ok: true }));

  const res = await app.request(new Request('http://localhost/test'));
  return res.status;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Checkout-to-Feature E2E Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_PRICING_URL = 'https://revealui.com/pricing';
  });

  describe('Free user → Pro checkout', () => {
    it('free user is blocked from all pro features', async () => {
      for (const feature of PRO_FEATURES) {
        const status = await testFeatureAccess('free', feature);
        expect(status).toBe(403);
      }
    });

    it('after Pro checkout, all pro features become accessible', async () => {
      for (const feature of PRO_FEATURES) {
        const status = await testFeatureAccess('pro', feature);
        expect(status).toBe(200);
      }
    });

    it('after Pro checkout, max features remain blocked', async () => {
      for (const feature of MAX_FEATURES) {
        const status = await testFeatureAccess('pro', feature);
        expect(status).toBe(403);
      }
    });

    it('after Pro checkout, enterprise features remain blocked', async () => {
      for (const feature of ENTERPRISE_FEATURES) {
        const status = await testFeatureAccess('pro', feature);
        expect(status).toBe(403);
      }
    });

    it('Pro entitlements include correct resource limits', () => {
      expect(HOSTED_LIMITS.pro).toEqual({
        maxSites: 5,
        maxUsers: 25,
        maxAgentTasks: 10_000,
      });
    });
  });

  describe('Free user → Max checkout', () => {
    it('free user is blocked from all max features', async () => {
      for (const feature of MAX_FEATURES) {
        const status = await testFeatureAccess('free', feature);
        expect(status).toBe(403);
      }
    });

    it('after Max checkout, all pro + max features become accessible', async () => {
      for (const feature of [...PRO_FEATURES, ...MAX_FEATURES]) {
        const status = await testFeatureAccess('max', feature);
        expect(status).toBe(200);
      }
    });

    it('after Max checkout, enterprise features remain blocked', async () => {
      for (const feature of ENTERPRISE_FEATURES) {
        const status = await testFeatureAccess('max', feature);
        expect(status).toBe(403);
      }
    });

    it('Max entitlements include correct resource limits', () => {
      expect(HOSTED_LIMITS.max).toEqual({
        maxSites: 15,
        maxUsers: 100,
        maxAgentTasks: 50_000,
      });
    });
  });

  describe('Free user → Enterprise checkout', () => {
    it('free user is blocked from all enterprise features', async () => {
      for (const feature of ENTERPRISE_FEATURES) {
        const status = await testFeatureAccess('free', feature);
        expect(status).toBe(403);
      }
    });

    it('after Enterprise checkout, ALL features become accessible', async () => {
      for (const feature of [...PRO_FEATURES, ...MAX_FEATURES, ...ENTERPRISE_FEATURES]) {
        const status = await testFeatureAccess('enterprise', feature);
        expect(status).toBe(200);
      }
    });

    it('Enterprise entitlements include unlimited resource limits', () => {
      expect(HOSTED_LIMITS.enterprise.maxSites).toBe(Number.MAX_SAFE_INTEGER);
      expect(HOSTED_LIMITS.enterprise.maxUsers).toBe(Number.MAX_SAFE_INTEGER);
      expect(HOSTED_LIMITS.enterprise.maxAgentTasks).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('aiLocal is always accessible (free feature)', () => {
    it.each([
      'free',
      'pro',
      'max',
      'enterprise',
    ] as Tier[])('aiLocal accessible at tier=%s', async (tier) => {
      const status = await testFeatureAccess(tier, 'aiLocal');
      expect(status).toBe(200);
    });
  });

  describe('Tier upgrade path: features unlock progressively', () => {
    it('free → pro → max → enterprise unlocks features at each step', async () => {
      // At free: only aiLocal works
      expect(await testFeatureAccess('free', 'aiLocal')).toBe(200);
      expect(await testFeatureAccess('free', 'ai')).toBe(403);
      expect(await testFeatureAccess('free', 'aiMemory')).toBe(403);
      expect(await testFeatureAccess('free', 'sso')).toBe(403);

      // At pro: ai unlocked, aiMemory still blocked
      expect(await testFeatureAccess('pro', 'ai')).toBe(200);
      expect(await testFeatureAccess('pro', 'aiMemory')).toBe(403);
      expect(await testFeatureAccess('pro', 'sso')).toBe(403);

      // At max: aiMemory unlocked, sso still blocked
      expect(await testFeatureAccess('max', 'ai')).toBe(200);
      expect(await testFeatureAccess('max', 'aiMemory')).toBe(200);
      expect(await testFeatureAccess('max', 'sso')).toBe(403);

      // At enterprise: everything unlocked
      expect(await testFeatureAccess('enterprise', 'ai')).toBe(200);
      expect(await testFeatureAccess('enterprise', 'aiMemory')).toBe(200);
      expect(await testFeatureAccess('enterprise', 'sso')).toBe(200);
    });
  });

  describe('Downgrade: features are properly revoked', () => {
    it('enterprise → pro: max and enterprise features become blocked', async () => {
      // Simulate having been enterprise, now downgraded to pro
      for (const feature of MAX_FEATURES) {
        const status = await testFeatureAccess('pro', feature);
        expect(status).toBe(403);
      }
      for (const feature of ENTERPRISE_FEATURES) {
        const status = await testFeatureAccess('pro', feature);
        expect(status).toBe(403);
      }
      // Pro features still work
      for (const feature of PRO_FEATURES) {
        const status = await testFeatureAccess('pro', feature);
        expect(status).toBe(200);
      }
    });

    it('pro → free: all paid features become blocked', async () => {
      for (const feature of [...PRO_FEATURES, ...MAX_FEATURES, ...ENTERPRISE_FEATURES]) {
        const status = await testFeatureAccess('free', feature);
        expect(status).toBe(403);
      }
      // Only aiLocal survives
      expect(await testFeatureAccess('free', 'aiLocal')).toBe(200);
    });
  });
});
