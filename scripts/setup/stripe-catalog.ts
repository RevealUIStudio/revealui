/**
 * Stripe catalog declaration — products & prices the seeder may create and
 * the catalog-check treats as required.
 *
 * Extracted from seed-stripe.ts (which runs main() + loads the Stripe SDK on
 * import) so this pure data + the reconciliation predicates are importable by
 * tests and the drift validator without side effects — same rationale as
 * stripe-price-match.ts.
 *
 * This follows `@revealui/contracts/public-catalog`, not leftover admin SKUs
 * in `packages/contracts/src/pricing.ts`. Free is not a Stripe product.
 * Enterprise is inquire / Contact sales — not a self-serve SKU.
 *
 * Dollar amounts are the cents-of-record for the public keep-list:
 *   - RevealUI Pro $49 / $470, 7-day trial
 *   - RevealUI Max $299 / $2,870, 7-day trial
 *   - Pro Perpetual $1,499 + Pro Support Renewal $149/yr
 *
 * Marketing display: apps/marketing/app/lib/pricing-fallbacks.ts
 * Lockstep: scripts/setup/__tests__/stripe-catalog-lockstep.test.ts
 * and scripts/validate/pricing-lockstep.ts
 */

import type { PriceDefinition } from './stripe-price-match.js';

export interface ProductDefinition {
  key: string;
  name: string;
  description: string;
  tier: 'pro' | 'max' | 'enterprise';
  billingModel: 'subscription' | 'perpetual' | 'credits' | 'renewal';
  creditBundleName?: string;
  priceNote?: string;
  renewal?: string;
  defaultPriceKey: string;
  prices: PriceDefinition[];
}

export const CATALOG: ProductDefinition[] = [
  {
    key: 'revealui_pro',
    name: 'RevealUI Pro',
    description:
      'AI agents, MCP servers, editor integrations, and advanced sync. For professional developers and small teams.',
    tier: 'pro',
    billingModel: 'subscription',
    defaultPriceKey: 'revealui_pro_monthly',
    prices: [
      {
        key: 'revealui_pro_monthly',
        unitAmount: 4900,
        currency: 'usd',
        mode: 'subscription',
        interval: 'month',
        trialDays: 7,
      },
      {
        key: 'revealui_pro_yearly',
        unitAmount: 47000,
        currency: 'usd',
        mode: 'subscription',
        interval: 'year',
        trialDays: 7,
      },
    ],
  },
  {
    key: 'revealui_max',
    name: 'RevealUI Max',
    description:
      'AI memory, advanced inference configuration, audit log, and higher limits (15 projects, 100 users).',
    tier: 'max',
    billingModel: 'subscription',
    defaultPriceKey: 'revealui_max_monthly',
    prices: [
      {
        key: 'revealui_max_monthly',
        unitAmount: 29900,
        currency: 'usd',
        mode: 'subscription',
        interval: 'month',
        trialDays: 7,
      },
      {
        key: 'revealui_max_yearly',
        unitAmount: 287000,
        currency: 'usd',
        mode: 'subscription',
        interval: 'year',
        trialDays: 7,
      },
    ],
  },
  {
    key: 'revealui_pro_perpetual',
    name: 'Pro Perpetual',
    description: 'Pro features, forever. No subscription required.',
    tier: 'pro',
    billingModel: 'perpetual',
    priceNote: 'one-time',
    renewal: '$149/yr for continued support',
    defaultPriceKey: 'revealui_pro_perpetual',
    prices: [
      {
        key: 'revealui_pro_perpetual',
        unitAmount: 149900,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  {
    key: 'revealui_renewal_pro',
    name: 'Pro Support Renewal',
    description: 'Renew your Pro perpetual license support contract for 1 year.',
    tier: 'pro',
    billingModel: 'renewal',
    priceNote: 'annual',
    defaultPriceKey: 'revealui_renewal_pro',
    prices: [
      {
        key: 'revealui_renewal_pro',
        unitAmount: 14900,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
];

export const PRICE_ENV_KEYS: Record<string, string> = {
  revealui_pro_monthly: 'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
  revealui_pro_yearly: 'NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID',
  revealui_max_monthly: 'NEXT_PUBLIC_STRIPE_MAX_PRICE_ID',
  revealui_max_yearly: 'NEXT_PUBLIC_STRIPE_MAX_ANNUAL_PRICE_ID',
  revealui_pro_perpetual: 'NEXT_PUBLIC_STRIPE_PRO_PERPETUAL_PRICE_ID',
};
export const PRICE_SERVER_ENV_KEYS: Record<string, string> = {
  revealui_pro_monthly: 'STRIPE_PRO_PRICE_ID',
  revealui_pro_yearly: 'STRIPE_PRO_ANNUAL_PRICE_ID',
  revealui_max_monthly: 'STRIPE_MAX_PRICE_ID',
  revealui_max_yearly: 'STRIPE_MAX_ANNUAL_PRICE_ID',
  revealui_pro_perpetual: 'STRIPE_PERPETUAL_PRO_PRICE_ID',
  revealui_renewal_pro: 'STRIPE_RENEWAL_PRO_PRICE_ID',
};

// ─── Derived sets + pure reconciliation predicates ───────────────────────────
// Pure (no Stripe SDK, no I/O) so they unit-test with plain object literals —
// same pattern as stripe-price-match.ts. seed-stripe.ts feeds them live data.

/** Every product handle declared in CATALOG. */
export const DECLARED_PRODUCT_KEYS: ReadonlySet<string> = new Set(CATALOG.map((p) => p.key));

/** Minimal projection of a live Stripe product these predicates read. */
export interface ManagedProductView {
  id: string;
  active: boolean;
  /** metadata.revealui_product_key */
  productKey: string | null;
  /** metadata.revealui_track */
  track: string | null;
  /** metadata.revealui_tier */
  tier: string | null;
  /** default_price.unit_amount in cents, or null when unset */
  defaultPriceAmount: number | null;
}

export type CatalogDriftKind = 'orphan' | 'duplicate' | 'missing' | 'amount-mismatch';

export interface CatalogDriftIssue {
  kind: CatalogDriftKind;
  productKey: string | null;
  productId?: string;
  detail: string;
}

/**
 * A product is RevealUI-seed-managed when it carries the seed's track/tier
 * metadata. The seed stamps both on every product it creates, so this is the
 * blast-radius boundary: reconciliation only ever touches managed products.
 */
export function isManagedProduct(p: ManagedProductView): boolean {
  return p.track !== null || p.tier !== null;
}

/**
 * Orphans = ACTIVE managed products whose product_key is not in the declared
 * CATALOG (a missing/empty key, or a renamed/retired key). These are what the
 * convergent seed archives.
 */
export function findOrphanProducts(active: readonly ManagedProductView[]): ManagedProductView[] {
  return active.filter(
    (p) =>
      p.active &&
      isManagedProduct(p) &&
      !(p.productKey !== null && DECLARED_PRODUCT_KEYS.has(p.productKey)),
  );
}

/** Expected default-price amount (cents) for a declared product. */
function declaredDefaultAmount(def: ProductDefinition): number | null {
  return def.prices.find((pr) => pr.key === def.defaultPriceKey)?.unitAmount ?? null;
}

/**
 * Full drift report over the live active catalog vs the declaration:
 *  - orphan: active managed product not declared
 *  - duplicate: >1 active product sharing a declared product_key
 *  - missing: declared product has no active Stripe product
 *  - amount-mismatch: an active declared product's default_price != declared cents
 */
export function findCatalogDrift(active: readonly ManagedProductView[]): CatalogDriftIssue[] {
  const issues: CatalogDriftIssue[] = [];

  for (const p of findOrphanProducts(active)) {
    issues.push({
      kind: 'orphan',
      productKey: p.productKey,
      productId: p.id,
      detail: `active managed product not in declared CATALOG (track=${p.track ?? '-'} tier=${p.tier ?? '-'} amount=${p.defaultPriceAmount ?? '-'})`,
    });
  }

  const activeByKey = new Map<string, ManagedProductView[]>();
  for (const p of active) {
    if (!p.active || p.productKey === null) continue;
    const arr = activeByKey.get(p.productKey) ?? [];
    arr.push(p);
    activeByKey.set(p.productKey, arr);
  }

  for (const def of CATALOG) {
    const matches = activeByKey.get(def.key) ?? [];
    if (matches.length === 0) {
      issues.push({
        kind: 'missing',
        productKey: def.key,
        detail: 'declared product has no active Stripe product',
      });
      continue;
    }
    if (matches.length > 1) {
      issues.push({
        kind: 'duplicate',
        productKey: def.key,
        detail: `${matches.length} active products share this product_key (ids: ${matches.map((m) => m.id).join(', ')})`,
      });
    }
    const expected = declaredDefaultAmount(def);
    for (const m of matches) {
      if (expected !== null && m.defaultPriceAmount !== null && m.defaultPriceAmount !== expected) {
        issues.push({
          kind: 'amount-mismatch',
          productKey: def.key,
          productId: m.id,
          detail: `default_price ${m.defaultPriceAmount} != declared ${expected}`,
        });
      }
    }
  }

  return issues;
}

export interface StripeKeyPrefixValidation {
  ok: boolean;
  /** Error message to log when ok is false. */
  message?: string;
  /** True when the accepted key targets Stripe live mode (sk_live_ or rk_live_). */
  isLive: boolean;
}

/**
 * Validates STRIPE_SECRET_KEY's prefix against the operation mode.
 *
 * --check (the scheduled read-only drift gate, see
 * .github/workflows/stripe-catalog-check.yml) only ever reads the catalog via
 * products.list, so a least-privilege Stripe RESTRICTED key (rk_test_/rk_live_)
 * is the correct credential there and must be accepted. Do not require
 * balance_read on that key.
 *
 * Seeding/mutating runs (the default `pnpm stripe:seed` -- no --check) can
 * create or archive products, so a restricted key must never be accepted for
 * them -- only a full secret key (sk_test_/sk_live_) may run them.
 */
export function validateStripeSecretKeyPrefix(
  secretKey: string,
  checkMode: boolean,
): StripeKeyPrefixValidation {
  const validPrefixes = checkMode
    ? ['sk_test_', 'sk_live_', 'rk_test_', 'rk_live_']
    : ['sk_test_', 'sk_live_'];
  const ok = validPrefixes.some((prefix) => secretKey.startsWith(prefix));
  const isLive = secretKey.startsWith('sk_live_') || secretKey.startsWith('rk_live_');
  if (ok) {
    return { ok, isLive };
  }
  return {
    ok,
    isLive,
    message: checkMode
      ? 'STRIPE_SECRET_KEY must start with sk_test_, sk_live_, rk_test_, or rk_live_'
      : 'STRIPE_SECRET_KEY must start with sk_test_ or sk_live_ (restricted rk_ keys are not permitted for seeding/mutating runs)',
  };
}

/** Operator abort window before a live mutating seed continues. */
export const LIVE_KEY_ABORT_DELAY_MS = 5_000;

/**
 * The live-key abort delay is for an operator running a mutating seed.
 * `--check` (the scheduled catalog gate) is read-only and must not sleep.
 */
export function shouldPauseForLiveKeyAbort(checkMode: boolean): boolean {
  return !checkMode;
}
