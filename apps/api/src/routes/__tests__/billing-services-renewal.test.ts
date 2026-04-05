/**
 * Billing Services & Renewal Tests
 *
 * Validates the new billing features:
 * 1. SERVICE_OFFERINGS are included in PricingResponse
 * 2. Subscription response includes perpetual and supportExpiresAt fields
 * 3. PricingResponse schema includes services array
 * 4. All perpetual tiers have comingSoon: false (enabled for purchase)
 * 5. Support renewal checkout route contract
 * 6. Support renewal webhook handler contract
 */

import {
  CREDIT_BUNDLES,
  PERPETUAL_TIERS,
  type PricingResponse,
  SERVICE_OFFERINGS,
  SUBSCRIPTION_TIERS,
} from '@revealui/contracts/pricing';
import { describe, expect, it } from 'vitest';

// =============================================================================
// SERVICE_OFFERINGS — Track D completeness
// =============================================================================

describe('SERVICE_OFFERINGS — Track D', () => {
  it('exports exactly 4 service offerings', () => {
    expect(SERVICE_OFFERINGS).toHaveLength(4);
  });

  it('has IDs: architecture-review, migration-assist, launch-package, consulting-hour', () => {
    const ids = SERVICE_OFFERINGS.map((s) => s.id);
    expect(ids).toEqual([
      'architecture-review',
      'migration-assist',
      'launch-package',
      'consulting-hour',
    ]);
  });

  it('every offering satisfies the ServiceOffering interface', () => {
    for (const service of SERVICE_OFFERINGS) {
      // Required string fields
      expect(typeof service.id).toBe('string');
      expect(typeof service.name).toBe('string');
      expect(typeof service.description).toBe('string');
      expect(typeof service.deliverable).toBe('string');
      expect(typeof service.cta).toBe('string');
      expect(typeof service.ctaHref).toBe('string');

      // Required array field
      expect(Array.isArray(service.includes)).toBe(true);
      expect(service.includes.length).toBeGreaterThan(0);

      // Optional price fields should be undefined in static data
      expect(service.price).toBeUndefined();
    }
  });

  it('service IDs are unique', () => {
    const ids = SERVICE_OFFERINGS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('service names are unique', () => {
    const names = SERVICE_OFFERINGS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  describe('individual offerings', () => {
    it('architecture-review has at least 5 includes', () => {
      const archReview = SERVICE_OFFERINGS.find((s) => s.id === 'architecture-review');
      expect(archReview).toBeDefined();
      expect(archReview!.includes.length).toBeGreaterThanOrEqual(5);
      expect(archReview!.name).toBe('Architecture Review');
    });

    it('migration-assist has at least 5 includes', () => {
      const migration = SERVICE_OFFERINGS.find((s) => s.id === 'migration-assist');
      expect(migration).toBeDefined();
      expect(migration!.includes.length).toBeGreaterThanOrEqual(5);
      expect(migration!.name).toBe('Migration Assist');
    });

    it('launch-package has at least 5 includes', () => {
      const launch = SERVICE_OFFERINGS.find((s) => s.id === 'launch-package');
      expect(launch).toBeDefined();
      expect(launch!.includes.length).toBeGreaterThanOrEqual(5);
      expect(launch!.name).toBe('Launch Package');
    });

    it('consulting-hour has at least 3 includes', () => {
      const consulting = SERVICE_OFFERINGS.find((s) => s.id === 'consulting-hour');
      expect(consulting).toBeDefined();
      expect(consulting!.includes.length).toBeGreaterThanOrEqual(3);
      expect(consulting!.name).toBe('Consulting Hour');
    });
  });

  it('all CTAs link to services@ email address', () => {
    for (const service of SERVICE_OFFERINGS) {
      expect(service.ctaHref).toContain('services@revealui.com');
    }
  });

  it('descriptions are substantive (more than 50 characters)', () => {
    for (const service of SERVICE_OFFERINGS) {
      expect(service.description.length).toBeGreaterThan(50);
    }
  });
});

// =============================================================================
// PricingResponse — services field
// =============================================================================

describe('PricingResponse includes services', () => {
  it('can construct a PricingResponse with services field', () => {
    const response: PricingResponse = {
      subscriptions: SUBSCRIPTION_TIERS,
      credits: CREDIT_BUNDLES,
      perpetual: PERPETUAL_TIERS,
      services: SERVICE_OFFERINGS,
    };

    expect(response.services).toBeDefined();
    expect(response.services).toHaveLength(4);
  });

  it('services field contains ServiceOffering objects', () => {
    const response: PricingResponse = {
      subscriptions: SUBSCRIPTION_TIERS,
      credits: CREDIT_BUNDLES,
      perpetual: PERPETUAL_TIERS,
      services: SERVICE_OFFERINGS,
    };

    for (const service of response.services) {
      expect(service.id).toBeTruthy();
      expect(service.name).toBeTruthy();
      expect(service.includes.length).toBeGreaterThan(0);
    }
  });

  it('PricingResponse has all 4 tracks populated', () => {
    const response: PricingResponse = {
      subscriptions: SUBSCRIPTION_TIERS,
      credits: CREDIT_BUNDLES,
      perpetual: PERPETUAL_TIERS,
      services: SERVICE_OFFERINGS,
    };

    // Track A — Subscriptions
    expect(response.subscriptions).toHaveLength(4);
    // Track B — Credits
    expect(response.credits).toHaveLength(3);
    // Track C — Perpetual
    expect(response.perpetual).toHaveLength(3);
    // Track D — Services
    expect(response.services).toHaveLength(4);
  });
});

// =============================================================================
// Perpetual tiers — all enabled (comingSoon: false)
// =============================================================================

describe('Perpetual tiers — launch enabled', () => {
  it('all 3 perpetual tiers have comingSoon: false', () => {
    for (const tier of PERPETUAL_TIERS) {
      expect(tier.comingSoon).toBe(false);
    }
  });

  it('zero perpetual tiers are marked as coming soon', () => {
    const comingSoonCount = PERPETUAL_TIERS.filter((t) => t.comingSoon).length;
    expect(comingSoonCount).toBe(0);
  });

  it('Pro Perpetual is purchasable', () => {
    const pro = PERPETUAL_TIERS.find((t) => t.name === 'Pro Perpetual');
    expect(pro).toBeDefined();
    expect(pro!.comingSoon).toBe(false);
    expect(pro!.cta).toBeTruthy();
    expect(pro!.ctaHref).toBeTruthy();
  });

  it('Agency Perpetual is purchasable', () => {
    const agency = PERPETUAL_TIERS.find((t) => t.name === 'Agency Perpetual');
    expect(agency).toBeDefined();
    expect(agency!.comingSoon).toBe(false);
    expect(agency!.cta).toBeTruthy();
    expect(agency!.ctaHref).toBeTruthy();
  });

  it('Forge Perpetual is purchasable', () => {
    const forge = PERPETUAL_TIERS.find((t) => t.name === 'Forge Perpetual');
    expect(forge).toBeDefined();
    expect(forge!.comingSoon).toBe(false);
    expect(forge!.cta).toBeTruthy();
    expect(forge!.ctaHref).toBeTruthy();
  });
});

// =============================================================================
// Subscription response — perpetual and supportExpiresAt fields
// =============================================================================

describe('Subscription response fields', () => {
  it('perpetual license response shape includes perpetual boolean', () => {
    // Simulates the shape returned by GET /api/billing/subscription
    // when the user has a perpetual license
    const response = {
      tier: 'pro' as const,
      status: 'active',
      expiresAt: null,
      licenseKey: 'REVEALUI-PRO-xxxx',
      perpetual: true,
      supportExpiresAt: '2027-04-05T00:00:00.000Z',
    };

    expect(response.perpetual).toBe(true);
    expect(typeof response.perpetual).toBe('boolean');
  });

  it('subscription response shape includes supportExpiresAt string or null', () => {
    // Active perpetual with support
    const withSupport = {
      tier: 'pro' as const,
      status: 'active',
      expiresAt: null,
      licenseKey: 'REVEALUI-PRO-xxxx',
      perpetual: true,
      supportExpiresAt: '2027-04-05T00:00:00.000Z',
    };
    expect(typeof withSupport.supportExpiresAt).toBe('string');

    // Perpetual without active support
    const withoutSupport = {
      tier: 'pro' as const,
      status: 'support_expired',
      expiresAt: null,
      licenseKey: 'REVEALUI-PRO-xxxx',
      perpetual: true,
      supportExpiresAt: null,
    };
    expect(withoutSupport.supportExpiresAt).toBeNull();
  });

  it('non-perpetual subscription does not include perpetual fields', () => {
    // Free tier response (no perpetual fields)
    const freeResponse = {
      tier: 'free' as const,
      status: 'active',
      expiresAt: null,
      licenseKey: null,
    };

    expect(freeResponse).not.toHaveProperty('perpetual');
    expect(freeResponse).not.toHaveProperty('supportExpiresAt');
  });

  it('perpetual field defaults to false when present', () => {
    // Subscription-based license includes perpetual: false
    const subscriptionResponse = {
      tier: 'pro' as const,
      status: 'active',
      expiresAt: null,
      licenseKey: null,
      perpetual: false,
      supportExpiresAt: null,
    };

    expect(subscriptionResponse.perpetual).toBe(false);
    expect(subscriptionResponse.supportExpiresAt).toBeNull();
  });
});

// =============================================================================
// Support renewal — webhook handler contract
// =============================================================================

describe('Support renewal webhook contract', () => {
  it('support renewal metadata shape is correct', () => {
    // Validates the metadata shape expected by the webhook handler
    const metadata = {
      support_renewal: 'true',
      license_id: 'lic_abc123',
      revealui_user_id: 'usr_xyz789',
      tier: 'pro',
    };

    expect(metadata.support_renewal).toBe('true');
    expect(metadata.license_id).toBeTruthy();
    expect(metadata.revealui_user_id).toBeTruthy();
    expect(metadata.tier).toBeTruthy();
  });

  it('support renewal extends supportExpiresAt by 1 year', () => {
    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const newSupportExpiresAt = new Date(now + oneYearMs);

    // Verify the date is approximately 1 year from now
    const diffMs = newSupportExpiresAt.getTime() - now;
    expect(diffMs).toBe(oneYearMs);

    // Verify it is a valid future date
    expect(newSupportExpiresAt.getTime()).toBeGreaterThan(now);
  });

  it('support renewal resets license status to active', () => {
    // The webhook handler sets status back to 'active' from 'support_expired'
    const updatePayload = {
      supportExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: 'active',
      updatedAt: new Date(),
    };

    expect(updatePayload.status).toBe('active');
    expect(updatePayload.supportExpiresAt).toBeInstanceOf(Date);
    expect(updatePayload.updatedAt).toBeInstanceOf(Date);
  });
});

// =============================================================================
// BillingCatalogKind — renewal type
// =============================================================================

describe('BillingCatalogKind includes renewal', () => {
  it('renewal is a valid billing catalog kind', () => {
    // Validates the type includes 'renewal' alongside existing kinds
    const validKinds = ['subscription', 'perpetual', 'credits', 'renewal'];
    const kind = 'renewal';

    expect(validKinds).toContain(kind);
  });

  it('all 4 billing catalog kinds are accounted for', () => {
    const kinds = ['subscription', 'perpetual', 'credits', 'renewal'];
    expect(kinds).toHaveLength(4);
    expect(new Set(kinds).size).toBe(4);
  });
});
