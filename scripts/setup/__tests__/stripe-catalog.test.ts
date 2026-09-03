import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  DECLARED_PRODUCT_KEYS,
  findCatalogDrift,
  findOrphanProducts,
  isManagedProduct,
  LIVE_KEY_ABORT_DELAY_MS,
  type ManagedProductView,
  shouldPauseForLiveKeyAbort,
  validateStripeSecretKeyPrefix,
} from '../stripe-catalog.js';

/**
 * Cents-of-record for SKUs the seeder may create. Public keep-list lives in
 * `@revealui/contracts/public-catalog`. Marketing display is cross-checked by
 * scripts/validate/pricing-lockstep.ts.
 */
const CENTS_OF_RECORD: Record<string, number> = {
  revealui_pro_monthly: 4900,
  revealui_pro_yearly: 39900,
  revealui_max_monthly: 9900,
  revealui_max_yearly: 79900,
  revealui_pro_perpetual: 149900,
  revealui_renewal_pro: 14900,
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

  it('declares exactly the public keep-list product handles', () => {
    expect([...DECLARED_PRODUCT_KEYS].sort()).toEqual(
      ['revealui_max', 'revealui_pro', 'revealui_pro_perpetual', 'revealui_renewal_pro'].sort(),
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
          id: 'pro',
          track: 'subscription',
          tier: 'pro',
          productKey: 'revealui_pro',
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
        tier: 'pro',
        productKey: 'revealui_pro',
        defaultPriceAmount: 4900,
      }),
      view({
        id: 'b',
        track: 'subscription',
        tier: 'pro',
        productKey: 'revealui_pro',
        defaultPriceAmount: 4900,
      }),
    ]);
    expect(issues.some((i) => i.kind === 'duplicate' && i.productKey === 'revealui_pro')).toBe(
      true,
    );
  });
  it('reports an amount mismatch against the declared cents', () => {
    const issues = findCatalogDrift([
      view({
        id: 'a',
        track: 'subscription',
        tier: 'pro',
        productKey: 'revealui_pro',
        defaultPriceAmount: 29900,
      }),
    ]);
    expect(
      issues.some((i) => i.kind === 'amount-mismatch' && i.productKey === 'revealui_pro'),
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
      findCatalogDrift([]).some((i) => i.kind === 'missing' && i.productKey === 'revealui_pro'),
    ).toBe(true);
  });
});

describe('validateStripeSecretKeyPrefix', () => {
  it('accepts a full secret key in check mode', () => {
    expect(validateStripeSecretKeyPrefix('sk_test_abc', true)).toEqual({
      ok: true,
      isLive: false,
    });
    expect(validateStripeSecretKeyPrefix('sk_live_abc', true)).toEqual({
      ok: true,
      isLive: true,
    });
  });

  it('accepts a full secret key in seed/mutating mode', () => {
    expect(validateStripeSecretKeyPrefix('sk_test_abc', false)).toEqual({
      ok: true,
      isLive: false,
    });
    expect(validateStripeSecretKeyPrefix('sk_live_abc', false)).toEqual({
      ok: true,
      isLive: true,
    });
  });

  it('accepts a restricted key in check mode (least-privilege read-only gate)', () => {
    expect(validateStripeSecretKeyPrefix('rk_test_abc', true)).toEqual({
      ok: true,
      isLive: false,
    });
    expect(validateStripeSecretKeyPrefix('rk_live_abc', true)).toEqual({
      ok: true,
      isLive: true,
    });
  });

  it('rejects a restricted key in seed/mutating mode (can create/archive products)', () => {
    const testResult = validateStripeSecretKeyPrefix('rk_test_abc', false);
    expect(testResult.ok).toBe(false);
    expect(testResult.message).toContain('restricted rk_ keys are not permitted');

    const liveResult = validateStripeSecretKeyPrefix('rk_live_abc', false);
    expect(liveResult.ok).toBe(false);
    expect(liveResult.isLive).toBe(true);
  });

  it('rejects a garbage prefix in either mode', () => {
    expect(validateStripeSecretKeyPrefix('pk_test_abc', true).ok).toBe(false);
    expect(validateStripeSecretKeyPrefix('pk_test_abc', false).ok).toBe(false);
  });
});

describe('shouldPauseForLiveKeyAbort', () => {
  it('does not pause in --check mode (CI catalog gate must not sleep 5s)', () => {
    expect(shouldPauseForLiveKeyAbort(true)).toBe(false);
  });

  it('pauses for a live mutating seed so an operator can Ctrl+C', () => {
    expect(shouldPauseForLiveKeyAbort(false)).toBe(true);
    expect(LIVE_KEY_ABORT_DELAY_MS).toBe(5_000);
  });
});
