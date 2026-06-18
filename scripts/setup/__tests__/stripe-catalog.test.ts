import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  DECLARED_PRODUCT_KEYS,
  findCatalogDrift,
  findOrphanProducts,
  isManagedProduct,
  type ManagedProductView,
} from '../stripe-catalog.js';

/**
 * Cents-of-record. MUST equal .jv/business/offerings-canonical.md (pinned
 * 2026-06-07). This is the seed side of the pricing lockstep; the marketing
 * display side is cross-checked by scripts/validate/pricing-lockstep.ts.
 */
const CENTS_OF_RECORD: Record<string, number> = {
  revealui_pro_monthly: 4900,
  revealui_pro_yearly: 47000,
  revealui_max_monthly: 29900,
  revealui_max_yearly: 287000,
  revealui_enterprise_monthly: 149900,
  revealui_enterprise_yearly: 1439000,
  revealui_pro_perpetual: 149900,
  revealui_max_perpetual: 849900,
  revealui_enterprise_perpetual: 4299900,
  revealui_renewal_pro: 14900,
  revealui_renewal_max: 79900,
  revealui_renewal_enterprise: 399900,
  revealui_credits_starter: 1000,
  revealui_credits_standard: 5000,
  revealui_credits_scale: 25000,
};

function priceCents(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const product of CATALOG) {
    for (const price of product.prices) {
      out[price.key] = price.unitAmount;
    }
  }
  return out;
}

function view(o: Partial<ManagedProductView> & { id: string }): ManagedProductView {
  return {
    active: true,
    productKey: null,
    track: null,
    tier: null,
    defaultPriceAmount: null,
    ...o,
  };
}

describe('stripe-catalog cents-of-record', () => {
  it('every CATALOG price equals the canonical cents-of-record (no drift, no extras)', () => {
    expect(priceCents()).toEqual(CENTS_OF_RECORD);
  });

  it('declares exactly the 12 known product handles', () => {
    expect([...DECLARED_PRODUCT_KEYS].sort()).toEqual(
      [
        'revealui_credits_scale',
        'revealui_credits_standard',
        'revealui_credits_starter',
        'revealui_enterprise',
        'revealui_enterprise_perpetual',
        'revealui_max',
        'revealui_max_perpetual',
        'revealui_pro',
        'revealui_pro_perpetual',
        'revealui_renewal_enterprise',
        'revealui_renewal_max',
        'revealui_renewal_pro',
      ].sort(),
    );
  });

  it('each product default price key exists among its prices', () => {
    for (const product of CATALOG) {
      expect(product.prices.map((p) => p.key)).toContain(product.defaultPriceKey);
    }
  });
});

describe('isManagedProduct', () => {
  it('is managed when track or tier is present', () => {
    expect(isManagedProduct(view({ id: 'p', track: 'subscription' }))).toBe(true);
    expect(isManagedProduct(view({ id: 'p', tier: 'pro' }))).toBe(true);
  });
  it('is not managed when neither track nor tier is set', () => {
    expect(isManagedProduct(view({ id: 'p' }))).toBe(false);
  });
});

describe('findOrphanProducts', () => {
  it('flags an active managed product whose key is not declared', () => {
    const orphans = findOrphanProducts([
      view({ id: 'old', track: 'subscription', tier: 'enterprise', productKey: 'legacy_key' }),
    ]);
    expect(orphans.map((o) => o.id)).toEqual(['old']);
  });
  it('flags a managed product with a null product key (pre-scheme leftover)', () => {
    const orphans = findOrphanProducts([
      view({ id: 'forge', track: 'perpetual', tier: 'enterprise', productKey: null }),
    ]);
    expect(orphans.map((o) => o.id)).toEqual(['forge']);
  });
  it('keeps a declared product', () => {
    expect(
      findOrphanProducts([
        view({
          id: 'ent',
          track: 'subscription',
          tier: 'enterprise',
          productKey: 'revealui_enterprise',
        }),
      ]),
    ).toHaveLength(0);
  });
  it('ignores non-managed products even when undeclared', () => {
    expect(findOrphanProducts([view({ id: 'random' })])).toHaveLength(0);
  });
  it('ignores inactive products', () => {
    expect(
      findOrphanProducts([
        view({ id: 'old', active: false, track: 'subscription', productKey: 'legacy' }),
      ]),
    ).toHaveLength(0);
  });
});

describe('findCatalogDrift', () => {
  it('reports a duplicate when two active products share a declared key', () => {
    const issues = findCatalogDrift([
      view({
        id: 'a',
        track: 'subscription',
        tier: 'enterprise',
        productKey: 'revealui_enterprise',
        defaultPriceAmount: 149900,
      }),
      view({
        id: 'b',
        track: 'subscription',
        tier: 'enterprise',
        productKey: 'revealui_enterprise',
        defaultPriceAmount: 149900,
      }),
    ]);
    expect(
      issues.some((i) => i.kind === 'duplicate' && i.productKey === 'revealui_enterprise'),
    ).toBe(true);
  });
  it('reports an amount mismatch against the declared cents', () => {
    const issues = findCatalogDrift([
      view({
        id: 'a',
        track: 'subscription',
        tier: 'enterprise',
        productKey: 'revealui_enterprise',
        defaultPriceAmount: 29900,
      }),
    ]);
    expect(
      issues.some((i) => i.kind === 'amount-mismatch' && i.productKey === 'revealui_enterprise'),
    ).toBe(true);
  });
  it('reports an orphan for an undeclared managed product', () => {
    const issues = findCatalogDrift([
      view({
        id: 'old',
        track: 'subscription',
        tier: 'enterprise',
        productKey: 'legacy',
        defaultPriceAmount: 29900,
      }),
    ]);
    expect(issues.some((i) => i.kind === 'orphan' && i.productId === 'old')).toBe(true);
  });
  it('reports missing for a declared product with no active product', () => {
    expect(
      findCatalogDrift([]).some(
        (i) => i.kind === 'missing' && i.productKey === 'revealui_enterprise',
      ),
    ).toBe(true);
  });
});
