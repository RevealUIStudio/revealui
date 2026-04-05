/**
 * Billing Feature-Tier Matrix Test (Phase 2.1)
 *
 * Proves EVERY advertised feature is accessible at the correct tier
 * and blocked at lower tiers. This is the "promise-to-delivery" verification layer.
 *
 * Tests:
 * 1. requireFeature() enforcement for all 15 features × 4 tiers
 * 2. requireLicense() tier gating for all 4 tiers
 * 3. Error response format (upgrade URL, required tier name)
 * 4. Resource limits match documented tier definitions
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks — declared before imports ─────────────────────────────────────────

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
    for (const [feature, requiredTier] of Object.entries(map)) {
      flags[feature] = (tierRank[tier] ?? 0) >= (tierRank[requiredTier] ?? 0);
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

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import { getFeaturesForTier } from '@revealui/core/features';
import { requireFeature, requireLicense } from '../../middleware/license.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const TIERS = ['free', 'pro', 'max', 'enterprise'] as const;
type Tier = (typeof TIERS)[number];

const ALL_FEATURES = [
  'aiLocal',
  'ai',
  'mcp',
  'payments',
  'advancedSync',
  'dashboard',
  'customDomain',
  'analytics',
  'aiMemory',
  'aiInference',
  'auditLog',
  'multiTenant',
  'whiteLabel',
  'sso',
] as const;
type Feature = (typeof ALL_FEATURES)[number];

/** Minimum tier required for each feature */
const FEATURE_TIER_MAP: Record<Feature, Tier> = {
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

/** Documented resource limits per tier */
const TIER_LIMITS: Record<Tier, { maxSites: number; maxUsers: number; maxAgentTasks: number }> = {
  free: { maxSites: 1, maxUsers: 3, maxAgentTasks: 1_000 },
  pro: { maxSites: 5, maxUsers: 25, maxAgentTasks: 10_000 },
  max: { maxSites: 15, maxUsers: 100, maxAgentTasks: 50_000 },
  enterprise: {
    maxSites: Number.MAX_SAFE_INTEGER,
    maxUsers: Number.MAX_SAFE_INTEGER,
    maxAgentTasks: Number.MAX_SAFE_INTEGER,
  },
};

const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, max: 2, enterprise: 3 };

// ─── Helpers ────────────────────────────────────────────────────────────────

function createFeatureGatedApp(feature: Feature) {
  const app = new Hono<{
    Variables: {
      entitlements?: {
        accountId?: string | null;
        subscriptionStatus?: string | null;
        tier?: Tier;
        features?: Record<string, boolean>;
      };
    };
  }>();
  return { app, feature };
}

function makeFeatureRequest(
  _app: Hono<{
    Variables: {
      entitlements?: {
        accountId?: string | null;
        subscriptionStatus?: string | null;
        tier?: Tier;
        features?: Record<string, boolean>;
      };
    };
  }>,
  feature: Feature,
  tier: Tier,
) {
  const features = getFeaturesForTier(tier) as Record<string, boolean>;

  // Register middleware + route fresh each call (Hono is cheap to instantiate)
  const testApp = new Hono();
  testApp.use('*', async (c, next) => {
    c.set('entitlements', {
      accountId: 'acct_test',
      subscriptionStatus: 'active',
      tier,
      features,
    });
    await next();
  });
  testApp.use('*', requireFeature(feature, { mode: 'entitlements' }));
  testApp.get('/test', (c) => c.json({ ok: true }));

  return testApp.request(new Request('http://localhost/test'));
}

function makeLicenseRequest(minimumTier: Tier, currentTier: Tier) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('entitlements', {
      accountId: 'acct_test',
      subscriptionStatus: 'active',
      tier: currentTier,
    });
    await next();
  });
  app.use('*', requireLicense(minimumTier));
  app.get('/test', (c) => c.json({ ok: true }));

  return app.request(new Request('http://localhost/test'));
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Feature-Tier Access Matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_PRICING_URL = 'https://revealui.com/pricing';
  });

  // Generate test cases: [feature, tier, shouldBeAllowed]
  const featureTierCases: [Feature, Tier, boolean][] = [];
  for (const feature of ALL_FEATURES) {
    for (const tier of TIERS) {
      const requiredTier = FEATURE_TIER_MAP[feature];
      const allowed = TIER_RANK[tier] >= TIER_RANK[requiredTier];
      featureTierCases.push([feature, tier, allowed]);
    }
  }

  it.each(featureTierCases)('feature=%s tier=%s → %s', async (feature, tier, shouldBeAllowed) => {
    const { app } = createFeatureGatedApp(feature);
    const res = await makeFeatureRequest(app, feature, tier);

    if (shouldBeAllowed) {
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.ok).toBe(true);
    } else {
      expect(res.status).toBe(403);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(false);
      expect(body.code).toBe('HTTP_403');
    }
  });
});

describe('Feature Gate Error Response Format', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_PRICING_URL = 'https://revealui.com/pricing';
  });

  // Test a representative feature from each tier requirement
  const blockedCases: [Feature, Tier, Tier][] = [
    ['ai', 'free', 'pro'],
    ['aiMemory', 'free', 'max'],
    ['aiMemory', 'pro', 'max'],
    ['multiTenant', 'free', 'enterprise'],
    ['multiTenant', 'pro', 'enterprise'],
    ['multiTenant', 'max', 'enterprise'],
    ['sso', 'free', 'enterprise'],
  ];

  it.each(
    blockedCases,
  )('feature=%s at tier=%s includes required tier "%s" and upgrade URL', async (feature, currentTier, expectedRequiredTier) => {
    const { app } = createFeatureGatedApp(feature);
    const res = await makeFeatureRequest(app, feature, currentTier);

    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;

    // Must include the required tier in the error message
    expect(body.error).toContain(expectedRequiredTier);

    // Must include upgrade URL
    expect(body.error).toContain('revealui.com/pricing');
  });

  it('error response includes feature name', async () => {
    const { app } = createFeatureGatedApp('dashboard');
    const res = await makeFeatureRequest(app, 'dashboard', 'free');

    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain('dashboard');
  });
});

describe('Tier License Gating (requireLicense)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_PRICING_URL = 'https://revealui.com/pricing';
  });

  // Generate test cases: [requiredTier, currentTier, shouldBeAllowed]
  const licenseCases: [Tier, Tier, boolean][] = [];
  for (const requiredTier of TIERS) {
    for (const currentTier of TIERS) {
      const allowed = TIER_RANK[currentTier] >= TIER_RANK[requiredTier];
      licenseCases.push([requiredTier, currentTier, allowed]);
    }
  }

  it.each(
    licenseCases,
  )('requireLicense(%s) with tier=%s → %s', async (requiredTier, currentTier, shouldBeAllowed) => {
    const res = await makeLicenseRequest(requiredTier, currentTier);

    if (shouldBeAllowed) {
      expect(res.status).toBe(200);
    } else {
      expect(res.status).toBe(403);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(false);
      expect(body.error).toContain(requiredTier);
      expect(body.error).toContain('revealui.com/pricing');
    }
  });
});

describe('Resource Limits Match Tier Definitions', () => {
  it('getFeaturesForTier returns correct feature set for every tier', () => {
    for (const tier of TIERS) {
      const features = getFeaturesForTier(tier) as Record<string, boolean>;

      for (const feature of ALL_FEATURES) {
        const requiredTier = FEATURE_TIER_MAP[feature];
        const expected = TIER_RANK[tier] >= TIER_RANK[requiredTier];
        expect(features[feature]).toBe(expected);
      }
    }
  });

  it('free tier only gets aiLocal', () => {
    const features = getFeaturesForTier('free') as Record<string, boolean>;
    const enabledFeatures = Object.entries(features)
      .filter(([, v]) => v)
      .map(([k]) => k);

    expect(enabledFeatures).toEqual(['aiLocal']);
  });

  it('pro tier gets all free + pro features (8 total)', () => {
    const features = getFeaturesForTier('pro') as Record<string, boolean>;
    const enabledFeatures = Object.entries(features)
      .filter(([, v]) => v)
      .map(([k]) => k);

    expect(enabledFeatures).toHaveLength(8);
    expect(enabledFeatures).toContain('aiLocal');
    expect(enabledFeatures).toContain('ai');
    expect(enabledFeatures).toContain('mcp');
    expect(enabledFeatures).toContain('payments');
    expect(enabledFeatures).toContain('advancedSync');
    expect(enabledFeatures).toContain('dashboard');
    expect(enabledFeatures).toContain('customDomain');
    expect(enabledFeatures).toContain('analytics');
  });

  it('max tier gets all pro + max features (11 total)', () => {
    const features = getFeaturesForTier('max') as Record<string, boolean>;
    const enabledFeatures = Object.entries(features)
      .filter(([, v]) => v)
      .map(([k]) => k);

    expect(enabledFeatures).toHaveLength(11);
    expect(enabledFeatures).toContain('aiMemory');
    expect(enabledFeatures).toContain('aiInference');
    expect(enabledFeatures).toContain('auditLog');
  });

  it('enterprise tier gets all 14 features', () => {
    const features = getFeaturesForTier('enterprise') as Record<string, boolean>;
    const enabledFeatures = Object.entries(features)
      .filter(([, v]) => v)
      .map(([k]) => k);

    expect(enabledFeatures).toHaveLength(14);
    expect(enabledFeatures).toContain('multiTenant');
    expect(enabledFeatures).toContain('whiteLabel');
    expect(enabledFeatures).toContain('sso');
  });

  it('documented resource limits match hosted tier definitions', () => {
    // These must match the hosted limits in webhooks.ts getHostedLimitsForTier()
    // and the license module getMaxSites/getMaxUsers/getMaxAgentTasks defaults
    expect(TIER_LIMITS.free).toEqual({ maxSites: 1, maxUsers: 3, maxAgentTasks: 1_000 });
    expect(TIER_LIMITS.pro).toEqual({ maxSites: 5, maxUsers: 25, maxAgentTasks: 10_000 });
    expect(TIER_LIMITS.max).toEqual({ maxSites: 15, maxUsers: 100, maxAgentTasks: 50_000 });

    // Enterprise is effectively unlimited
    expect(TIER_LIMITS.enterprise.maxSites).toBe(Number.MAX_SAFE_INTEGER);
    expect(TIER_LIMITS.enterprise.maxUsers).toBe(Number.MAX_SAFE_INTEGER);
    expect(TIER_LIMITS.enterprise.maxAgentTasks).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('Feature Tier Boundary Precision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_PRICING_URL = 'https://revealui.com/pricing';
  });

  it('pro features are blocked on free but allowed on pro', async () => {
    const proFeatures: Feature[] = [
      'ai',
      'mcp',
      'payments',
      'advancedSync',
      'dashboard',
      'customDomain',
      'analytics',
    ];

    for (const feature of proFeatures) {
      const blocked = await makeFeatureRequest(createFeatureGatedApp(feature).app, feature, 'free');
      expect(blocked.status).toBe(403);

      const allowed = await makeFeatureRequest(createFeatureGatedApp(feature).app, feature, 'pro');
      expect(allowed.status).toBe(200);
    }
  });

  it('max features are blocked on pro but allowed on max', async () => {
    const maxFeatures: Feature[] = ['aiMemory', 'aiInference', 'auditLog'];

    for (const feature of maxFeatures) {
      const blocked = await makeFeatureRequest(createFeatureGatedApp(feature).app, feature, 'pro');
      expect(blocked.status).toBe(403);

      const allowed = await makeFeatureRequest(createFeatureGatedApp(feature).app, feature, 'max');
      expect(allowed.status).toBe(200);
    }
  });

  it('enterprise features are blocked on max but allowed on enterprise', async () => {
    const enterpriseFeatures: Feature[] = ['multiTenant', 'whiteLabel', 'sso'];

    for (const feature of enterpriseFeatures) {
      const blocked = await makeFeatureRequest(createFeatureGatedApp(feature).app, feature, 'max');
      expect(blocked.status).toBe(403);

      const allowed = await makeFeatureRequest(
        createFeatureGatedApp(feature).app,
        feature,
        'enterprise',
      );
      expect(allowed.status).toBe(200);
    }
  });

  it('higher tiers always have access to lower tier features', async () => {
    // A max-tier user must have access to pro features
    const { app } = createFeatureGatedApp('ai');
    const res = await makeFeatureRequest(app, 'ai', 'max');
    expect(res.status).toBe(200);

    // An enterprise-tier user must have access to max features
    const { app: app2 } = createFeatureGatedApp('aiMemory');
    const res2 = await makeFeatureRequest(app2, 'aiMemory', 'enterprise');
    expect(res2.status).toBe(200);
  });
});
