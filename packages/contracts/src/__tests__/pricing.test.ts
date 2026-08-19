import { describe, expect, it } from 'vitest';
import {
  CREDIT_BUNDLES,
  FEATURE_LABELS,
  FOUNDER_SERVICE_OFFERINGS,
  getTierColor,
  getTierLabel,
  getTiersFromCurrent,
  type LicenseTierId,
  PERPETUAL_TIERS,
  type PricingResponse,
  perpetualMaxSitesForTier,
  type ServiceOffering,
  SUBSCRIPTION_TIERS,
  TIER_COLORS,
  TIER_LABELS,
  TIER_LIMITS,
} from '../pricing.js';

// =============================================================================
// LicenseTierId coverage
// =============================================================================

describe('LicenseTierId', () => {
  const ALL_TIERS: LicenseTierId[] = ['free', 'pro', 'max', 'enterprise'];

  it('TIER_LABELS has entries for all tiers', () => {
    for (const tier of ALL_TIERS) {
      expect(TIER_LABELS[tier]).toBeDefined();
      expect(typeof TIER_LABELS[tier]).toBe('string');
    }
  });

  it('TIER_COLORS has entries for all tiers', () => {
    for (const tier of ALL_TIERS) {
      expect(TIER_COLORS[tier]).toBeDefined();
      expect(TIER_COLORS[tier]).toContain('bg-');
    }
  });

  it('TIER_LIMITS has entries for all tiers', () => {
    for (const tier of ALL_TIERS) {
      const limits = TIER_LIMITS[tier];
      expect(limits).toBeDefined();
      expect(typeof limits.apiRequestsPerMinute).toBe('number');
    }
  });
});

// =============================================================================
// TIER_LIMITS
// =============================================================================

describe('TIER_LIMITS', () => {
  it('free tier has the most restrictive limits', () => {
    expect(TIER_LIMITS.free.sites).toBe(1);
    expect(TIER_LIMITS.free.users).toBe(3);
    expect(TIER_LIMITS.free.apiRequestsPerMinute).toBe(200);
  });

  it('enterprise tier has unlimited sites/users (null)', () => {
    expect(TIER_LIMITS.enterprise.sites).toBeNull();
    expect(TIER_LIMITS.enterprise.users).toBeNull();
    expect(TIER_LIMITS.enterprise.agentTasks).toBeNull();
  });

  it('tiers increase in limits monotonically', () => {
    const order: LicenseTierId[] = ['free', 'pro', 'max'];
    for (let i = 0; i < order.length - 1; i++) {
      const current = TIER_LIMITS[order[i]];
      const next = TIER_LIMITS[order[i + 1]];
      expect(next.apiRequestsPerMinute).toBeGreaterThan(current.apiRequestsPerMinute);
      expect(next.sites!).toBeGreaterThan(current.sites!);
      expect(next.users!).toBeGreaterThan(current.users!);
    }
  });
});

// =============================================================================
// perpetualMaxSitesForTier (GAP-448 Agency Founding Kit mint caps)
// =============================================================================

describe('perpetualMaxSitesForTier', () => {
  it('pro perpetual matches Pro site cap', () => {
    expect(perpetualMaxSitesForTier('pro')).toBe(5);
  });

  it('max perpetual is Agency 10 sites (not subscription Max 15)', () => {
    expect(perpetualMaxSitesForTier('max')).toBe(10);
    expect(TIER_LIMITS.max.sites).toBe(15);
  });

  it('enterprise perpetual omits maxSites (unlimited)', () => {
    expect(perpetualMaxSitesForTier('enterprise')).toBeNull();
  });
});

// =============================================================================
// SUBSCRIPTION_TIERS
// =============================================================================

describe('SUBSCRIPTION_TIERS', () => {
  it('has 4 tiers', () => {
    expect(SUBSCRIPTION_TIERS).toHaveLength(4);
  });

  it('tier IDs match LicenseTierId values', () => {
    const ids = SUBSCRIPTION_TIERS.map((t) => t.id);
    expect(ids).toEqual(['free', 'pro', 'max', 'enterprise']);
  });

  it('every tier has required structural fields', () => {
    for (const tier of SUBSCRIPTION_TIERS) {
      expect(tier.name).toBeTruthy();
      expect(tier.description).toBeTruthy();
      expect(tier.features.length).toBeGreaterThan(0);
      expect(tier.cta).toBeTruthy();
      expect(tier.ctaHref).toBeTruthy();
    }
  });

  it('price fields are undefined in static arrays (populated at runtime)', () => {
    for (const tier of SUBSCRIPTION_TIERS) {
      expect(tier.price).toBeUndefined();
    }
  });

  it('exactly one tier is highlighted (Pro)', () => {
    const highlighted = SUBSCRIPTION_TIERS.filter((t) => t.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].id).toBe('pro');
  });

  it('enterprise subscription CTA is contact sales, not a trial signup', () => {
    const enterprise = SUBSCRIPTION_TIERS.find((t) => t.id === 'enterprise')!;
    const pro = SUBSCRIPTION_TIERS.find((t) => t.id === 'pro')!;
    const max = SUBSCRIPTION_TIERS.find((t) => t.id === 'max')!;
    expect(enterprise.cta).toBe('Contact sales');
    expect(enterprise.ctaHref).toBe('https://revealui.com/contact');
    expect(enterprise.ctaHref.includes('signup')).toBe(false);
    expect(pro.cta).toBe('Start your 7-day free trial');
    expect(pro.ctaHref).toBe('/signup?plan=pro');
    expect(max.cta).toBe('Start your 7-day free trial');
    expect(max.ctaHref).toBe('/signup?plan=max');
    expect(enterprise.features.some((f) => f.includes('coming soon'))).toBe(true);
  });

  it('free tier has no period', () => {
    const free = SUBSCRIPTION_TIERS.find((t) => t.id === 'free')!;
    expect(free.period).toBeUndefined();
  });

  it('paid tiers do not include period in static data (populated at runtime)', () => {
    const paid = SUBSCRIPTION_TIERS.filter((t) => t.id !== 'free');
    for (const tier of paid) {
      expect(tier.period).toBeUndefined();
    }
  });
});

// =============================================================================
// CREDIT_BUNDLES
// =============================================================================

describe('CREDIT_BUNDLES', () => {
  it('has 3 bundles', () => {
    expect(CREDIT_BUNDLES).toHaveLength(3);
  });

  it('exactly one bundle is highlighted', () => {
    const highlighted = CREDIT_BUNDLES.filter((b) => b.highlighted);
    expect(highlighted).toHaveLength(1);
  });

  it('every bundle has required structural fields', () => {
    for (const bundle of CREDIT_BUNDLES) {
      expect(bundle.name).toBeTruthy();
      expect(bundle.tasks).toBeTruthy();
      expect(bundle.description).toBeTruthy();
    }
  });
});

// =============================================================================
// PERPETUAL_TIERS
// =============================================================================

describe('PERPETUAL_TIERS', () => {
  it('has 3 perpetual tiers', () => {
    expect(PERPETUAL_TIERS).toHaveLength(3);
  });

  it('every tier has required structural fields', () => {
    for (const tier of PERPETUAL_TIERS) {
      expect(tier.name).toBeTruthy();
      expect(tier.description).toBeTruthy();
      expect(tier.features.length).toBeGreaterThan(0);
    }
  });

  // GAP-306: renewal must be populated from the Stripe catalog cents-of-record
  // (scripts/setup/stripe-catalog.ts CATALOG), not left to the marketing
  // fallback file. Cents cross-checked by scripts/validate/pricing-lockstep.ts.
  it('every tier has a populated renewal price derived from the catalog', () => {
    expect(PERPETUAL_TIERS.find((t) => t.name === 'Pro Perpetual')?.renewal).toBe(
      '$149/yr for continued support',
    );
    expect(PERPETUAL_TIERS.find((t) => t.name === 'Agency Perpetual')?.renewal).toBe(
      '$799/yr for continued support',
    );
    expect(PERPETUAL_TIERS.find((t) => t.name === 'Enterprise Perpetual')?.renewal).toBe(
      '$3,999/yr for continued support',
    );
  });

  // GAP-306: a perpetual licensee must be able to purchase without email —
  // no perpetual-tier CTA may route to a mailto: link. Enterprise Perpetual
  // is Contact sales (not unattended self-serve), same door as Enterprise subscription.
  it('no perpetual tier CTA is a mailto: link', () => {
    for (const tier of PERPETUAL_TIERS) {
      expect(tier.ctaHref.startsWith('mailto:')).toBe(false);
    }
    expect(PERPETUAL_TIERS.find((t) => t.name === 'Pro Perpetual')?.ctaHref).toBe(
      '/account/license',
    );
    expect(PERPETUAL_TIERS.find((t) => t.name === 'Agency Perpetual')?.ctaHref).toBe(
      '/account/license',
    );
    expect(PERPETUAL_TIERS.find((t) => t.name === 'Enterprise Perpetual')?.ctaHref).toBe(
      'https://revealui.com/contact',
    );
  });
});

// =============================================================================
// FEATURE_LABELS
// =============================================================================

describe('FEATURE_LABELS', () => {
  it('has human-readable labels for all feature keys', () => {
    const keys = Object.keys(FEATURE_LABELS);
    expect(keys.length).toBeGreaterThan(10);
    for (const label of Object.values(FEATURE_LABELS)) {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(2);
    }
  });
});

// =============================================================================
// Helper functions
// =============================================================================

describe('getTiersFromCurrent', () => {
  it('returns all paid tiers for free user', () => {
    const tiers = getTiersFromCurrent('free');
    expect(tiers).toHaveLength(3);
    expect(tiers.map((t) => t.id)).toEqual(['pro', 'max', 'enterprise']);
  });

  it('returns max + enterprise for pro user', () => {
    const tiers = getTiersFromCurrent('pro');
    expect(tiers).toHaveLength(2);
    expect(tiers.map((t) => t.id)).toEqual(['max', 'enterprise']);
  });

  it('returns enterprise only for max user', () => {
    const tiers = getTiersFromCurrent('max');
    expect(tiers).toHaveLength(1);
    expect(tiers[0].id).toBe('enterprise');
  });

  it('returns empty for enterprise user', () => {
    const tiers = getTiersFromCurrent('enterprise');
    expect(tiers).toHaveLength(0);
  });
});

describe('getTierLabel', () => {
  it('returns label for each tier', () => {
    expect(getTierLabel('free')).toBe('Free (OSS)');
    expect(getTierLabel('pro')).toBe('Pro');
    expect(getTierLabel('enterprise')).toContain('Enterprise');
  });
});

describe('getTierColor', () => {
  it('returns Tailwind classes for each tier', () => {
    expect(getTierColor('free')).toContain('bg-zinc');
    expect(getTierColor('pro')).toContain('bg-blue');
    expect(getTierColor('enterprise')).toContain('bg-purple');
  });
});

// =============================================================================
// FOUNDER_SERVICE_OFFERINGS (Track D)
// =============================================================================

describe('FOUNDER_SERVICE_OFFERINGS', () => {
  it('has exactly 4 service offerings', () => {
    expect(FOUNDER_SERVICE_OFFERINGS).toHaveLength(4);
  });

  it('has the correct IDs in order', () => {
    const ids = FOUNDER_SERVICE_OFFERINGS.map((s) => s.id);
    expect(ids).toEqual([
      'architecture-review',
      'launch-package',
      'migration-assist',
      'consulting-hour',
    ]);
  });

  it('service IDs are unique', () => {
    const ids = FOUNDER_SERVICE_OFFERINGS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every offering has required structural fields', () => {
    for (const service of FOUNDER_SERVICE_OFFERINGS) {
      expect(service.id).toBeTruthy();
      expect(service.name).toBeTruthy();
      expect(service.description).toBeTruthy();
      expect(service.includes.length).toBeGreaterThan(0);
      expect(service.deliverable).toBeTruthy();
      expect(service.cta).toBeTruthy();
      expect(service.ctaHref).toBeTruthy();
    }
  });

  it('every offering has at least 3 includes', () => {
    for (const service of FOUNDER_SERVICE_OFFERINGS) {
      expect(service.includes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('all offerings have prices set', () => {
    for (const service of FOUNDER_SERVICE_OFFERINGS) {
      expect(service.price).toBeDefined();
    }
  });

  it('all CTAs point to Cal.com booking link', () => {
    for (const service of FOUNDER_SERVICE_OFFERINGS) {
      expect(service.ctaHref).toContain('cal.com/revealuistudio');
    }
  });

  it('ServiceOffering interface is properly typed', () => {
    const sample: ServiceOffering = FOUNDER_SERVICE_OFFERINGS[0];
    expect(typeof sample.id).toBe('string');
    expect(typeof sample.name).toBe('string');
    expect(typeof sample.description).toBe('string');
    expect(Array.isArray(sample.includes)).toBe(true);
    expect(typeof sample.deliverable).toBe('string');
    expect(typeof sample.cta).toBe('string');
    expect(typeof sample.ctaHref).toBe('string');
  });
});

// =============================================================================
// PricingResponse includes services
// =============================================================================

describe('PricingResponse', () => {
  it('interface includes services field', () => {
    // Construct a valid PricingResponse to verify the type includes services
    const response: PricingResponse = {
      subscriptions: SUBSCRIPTION_TIERS,
      credits: CREDIT_BUNDLES,
      perpetual: PERPETUAL_TIERS,
      services: FOUNDER_SERVICE_OFFERINGS,
    };

    expect(response.services).toBeDefined();
    expect(response.services).toHaveLength(4);
  });

  it('all four tracks are present in a complete PricingResponse', () => {
    const response: PricingResponse = {
      subscriptions: SUBSCRIPTION_TIERS,
      credits: CREDIT_BUNDLES,
      perpetual: PERPETUAL_TIERS,
      services: FOUNDER_SERVICE_OFFERINGS,
    };

    expect(response.subscriptions.length).toBeGreaterThan(0);
    expect(response.credits.length).toBeGreaterThan(0);
    expect(response.perpetual.length).toBeGreaterThan(0);
    expect(response.services.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Perpetual tiers  -  comingSoon status
// =============================================================================

describe('PERPETUAL_TIERS  -  comingSoon status', () => {
  it('all 3 perpetual tiers have comingSoon set to false', () => {
    for (const tier of PERPETUAL_TIERS) {
      expect(tier.comingSoon).toBe(false);
    }
  });

  it('Pro Perpetual is not coming soon', () => {
    const pro = PERPETUAL_TIERS.find((t) => t.name === 'Pro Perpetual');
    expect(pro).toBeDefined();
    expect(pro?.comingSoon).toBe(false);
  });

  it('Agency Perpetual is not coming soon', () => {
    const agency = PERPETUAL_TIERS.find((t) => t.name === 'Agency Perpetual');
    expect(agency).toBeDefined();
    expect(agency?.comingSoon).toBe(false);
  });

  it('Enterprise Perpetual is not coming soon', () => {
    const enterprise = PERPETUAL_TIERS.find((t) => t.name === 'Enterprise Perpetual');
    expect(enterprise).toBeDefined();
    expect(enterprise?.comingSoon).toBe(false);
  });

  it('Enterprise Perpetual CTA is contact sales, not an unattended Buy', () => {
    const enterprise = PERPETUAL_TIERS.find((t) => t.name === 'Enterprise Perpetual')!;
    const pro = PERPETUAL_TIERS.find((t) => t.name === 'Pro Perpetual')!;
    const agency = PERPETUAL_TIERS.find((t) => t.name === 'Agency Perpetual')!;
    expect(enterprise.cta).toBe('Contact sales');
    expect(enterprise.ctaHref).toBe('https://revealui.com/contact');
    expect(enterprise.ctaHref.includes('signup')).toBe(false);
    expect(enterprise.ctaHref.includes('/account/license')).toBe(false);
    expect(pro.cta).toBe('Buy Pro Perpetual');
    expect(pro.ctaHref).toBe('/account/license');
    expect(agency.cta).toBe('Buy Agency Perpetual');
    expect(agency.ctaHref).toBe('/account/license');
  });
});
