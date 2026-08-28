import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  DECLARED_PRODUCT_KEYS,
  PRICE_ENV_KEYS,
  PRICE_SERVER_ENV_KEYS,
} from '../stripe-catalog.js';

/**
 * Public keep-list the seeder may create. Must stay aligned with
 * `@revealui/contracts/public-catalog` (Free is not a Stripe product;
 * Enterprise is inquire / Contact sales, not a self-serve SKU).
 */
const SEED_PRODUCT_KEYS = [
  'revealui_pro',
  'revealui_max',
  'revealui_pro_perpetual',
  'revealui_renewal_pro',
] as const;

const SEED_CENTS_OF_RECORD: Record<string, number> = {
  revealui_pro_monthly: 4900,
  revealui_pro_yearly: 47000,
  revealui_max_monthly: 29900,
  revealui_max_yearly: 287000,
  revealui_pro_perpetual: 149900,
  revealui_renewal_pro: 14900,
};

const DEAD_PRODUCT_KEYS = [
  'revealui_enterprise',
  'revealui_max_perpetual',
  'revealui_enterprise_perpetual',
  'revealui_renewal_max',
  'revealui_renewal_enterprise',
  'revealui_credits_starter',
  'revealui_credits_standard',
  'revealui_credits_scale',
] as const;

const DEAD_NAME_MARKERS = [
  'Agency Perpetual',
  'Enterprise Perpetual',
  'Credits: Starter',
  'Credits: Standard',
  'Credits: Scale',
  'Fleet',
] as const;

function catalogPriceCents(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const product of CATALOG) {
    for (const price of product.prices) {
      out[price.key] = price.unitAmount;
    }
  }
  return out;
}

function catalogNames(): string[] {
  return CATALOG.map((product) => product.name);
}

describe('stripe-catalog public keep-list lockstep', () => {
  it('declares only the public self-serve Stripe products', () => {
    expect([...DECLARED_PRODUCT_KEYS].sort()).toEqual([...SEED_PRODUCT_KEYS].sort());
  });

  it('keeps the locked public amounts and no extras', () => {
    expect(catalogPriceCents()).toEqual(SEED_CENTS_OF_RECORD);
  });

  it('keeps Pro and Max subscription trials at 7 days', () => {
    const pro = CATALOG.find((product) => product.key === 'revealui_pro');
    const max = CATALOG.find((product) => product.key === 'revealui_max');
    expect(pro?.prices.find((price) => price.key === 'revealui_pro_monthly')?.trialDays).toBe(7);
    expect(pro?.prices.find((price) => price.key === 'revealui_pro_yearly')?.trialDays).toBe(7);
    expect(max?.prices.find((price) => price.key === 'revealui_max_monthly')?.trialDays).toBe(7);
    expect(max?.prices.find((price) => price.key === 'revealui_max_yearly')?.trialDays).toBe(7);
  });

  it('keeps Pro Perpetual and Pro Support Renewal as the only perpetual path', () => {
    const perpetual = CATALOG.filter((product) => product.billingModel === 'perpetual');
    const renewals = CATALOG.filter((product) => product.billingModel === 'renewal');
    expect(perpetual.map((product) => product.name)).toEqual(['Pro Perpetual']);
    expect(renewals.map((product) => product.key)).toEqual(['revealui_renewal_pro']);
    expect(perpetual[0]?.renewal).toBe('$149/yr for continued support');
  });

  it('does not declare retired SKUs the seeder must not recreate', () => {
    for (const key of DEAD_PRODUCT_KEYS) {
      expect(DECLARED_PRODUCT_KEYS.has(key), `${key} must leave the seeder CATALOG`).toBe(false);
    }
    const names = catalogNames();
    for (const marker of DEAD_NAME_MARKERS) {
      expect(
        names.some((name) => name.includes(marker)),
        `CATALOG must not declare ${marker}`,
      ).toBe(false);
    }
  });

  it('does not emit env keys for undeclared prices', () => {
    const declaredPriceKeys = new Set(
      CATALOG.flatMap((product) => product.prices.map((price) => price.key)),
    );
    for (const key of [...Object.keys(PRICE_ENV_KEYS), ...Object.keys(PRICE_SERVER_ENV_KEYS)]) {
      expect(declaredPriceKeys.has(key), `${key} is not a declared CATALOG price`).toBe(true);
    }
    expect(PRICE_SERVER_ENV_KEYS.revealui_renewal_pro).toBe('STRIPE_RENEWAL_PRO_PRICE_ID');
    expect(PRICE_ENV_KEYS.revealui_pro_monthly).toBe('NEXT_PUBLIC_STRIPE_PRO_PRICE_ID');
    expect(PRICE_ENV_KEYS.revealui_max_monthly).toBe('NEXT_PUBLIC_STRIPE_MAX_PRICE_ID');
    expect(PRICE_ENV_KEYS.revealui_pro_perpetual).toBe('NEXT_PUBLIC_STRIPE_PRO_PERPETUAL_PRICE_ID');
  });
});
