/**
 * Stripe catalog declaration — machine-readable single source of truth for the
 * products & prices the seeder syncs to Stripe and the validators check.
 *
 * Extracted from seed-stripe.ts (which runs main() + loads the Stripe SDK on
 * import) so this pure data + the reconciliation predicates are importable by
 * tests and the drift validator without side effects — same rationale as
 * stripe-price-match.ts.
 *
 * Dollar amounts are the cents-of-record. They MUST equal:
 *   - .jv/business/offerings-canonical.md (human source of truth, pinned)
 *   - apps/server/src/routes/pricing.ts HARDCODED_*_PRICES (server display fallback)
 *   - apps/marketing/app/lib/pricing-fallbacks.ts (client display fallback)
 * The lockstep test (scripts/setup/__tests__/stripe-catalog-lockstep.test.ts)
 * fails CI if these drift. Change all surfaces together.
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
    key: 'revealui_enterprise',
    name: 'RevealUI Enterprise',
    description:
      'SSO, audit logging, white-label, self-hosted deployment, and priority support. For agencies and enterprise teams.',
    tier: 'enterprise',
    billingModel: 'subscription',
    defaultPriceKey: 'revealui_enterprise_monthly',
    prices: [
      {
        key: 'revealui_enterprise_monthly',
        unitAmount: 149900,
        currency: 'usd',
        mode: 'subscription',
        interval: 'month',
      },
      {
        key: 'revealui_enterprise_yearly',
        unitAmount: 1439000,
        currency: 'usd',
        mode: 'subscription',
        interval: 'year',
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
    key: 'revealui_max_perpetual',
    name: 'Agency Perpetual',
    description: 'Deploy for multiple clients without per-site subscriptions.',
    tier: 'max',
    billingModel: 'perpetual',
    priceNote: 'one-time',
    renewal: '$799/yr for continued support',
    defaultPriceKey: 'revealui_max_perpetual',
    prices: [
      {
        key: 'revealui_max_perpetual',
        unitAmount: 849900,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  {
    key: 'revealui_enterprise_perpetual',
    name: 'Enterprise Perpetual',
    description: 'Full self-hosted Enterprise with unlimited deployments.',
    tier: 'enterprise',
    billingModel: 'perpetual',
    priceNote: 'one-time',
    renewal: '$3,999/yr for continued support',
    defaultPriceKey: 'revealui_enterprise_perpetual',
    prices: [
      {
        key: 'revealui_enterprise_perpetual',
        unitAmount: 4299900,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  // ── Support Renewal (Track C  -  annual renewal for perpetual licenses) ─────
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
  {
    key: 'revealui_renewal_max',
    name: 'Max Support Renewal',
    description: 'Renew your Max/Agency perpetual license support contract for 1 year.',
    tier: 'max',
    billingModel: 'renewal',
    priceNote: 'annual',
    defaultPriceKey: 'revealui_renewal_max',
    prices: [
      {
        key: 'revealui_renewal_max',
        unitAmount: 79900,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  {
    key: 'revealui_renewal_enterprise',
    name: 'Enterprise Support Renewal',
    description: 'Renew your Enterprise perpetual license support contract for 1 year.',
    tier: 'enterprise',
    billingModel: 'renewal',
    priceNote: 'annual',
    defaultPriceKey: 'revealui_renewal_enterprise',
    prices: [
      {
        key: 'revealui_renewal_enterprise',
        unitAmount: 399900,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  // ── Credit Bundles (Track B) ──────────────────────────────────────────────
  {
    key: 'revealui_credits_starter',
    name: 'Credits: Starter',
    description: '10,000 AI agent tasks. Top up any plan. Never expires.',
    tier: 'pro',
    billingModel: 'credits',
    creditBundleName: 'starter',
    priceNote: 'one-time',
    defaultPriceKey: 'revealui_credits_starter',
    prices: [
      {
        key: 'revealui_credits_starter',
        unitAmount: 1000,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  {
    key: 'revealui_credits_standard',
    name: 'Credits: Standard',
    description: '60,000 AI agent tasks. 17% cheaper per task vs Starter.',
    tier: 'pro',
    billingModel: 'credits',
    creditBundleName: 'standard',
    priceNote: 'one-time',
    defaultPriceKey: 'revealui_credits_standard',
    prices: [
      {
        key: 'revealui_credits_standard',
        unitAmount: 5000,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  {
    key: 'revealui_credits_scale',
    name: 'Credits: Scale',
    description: '350,000 AI agent tasks. 29% cheaper per task vs Starter.',
    tier: 'pro',
    billingModel: 'credits',
    creditBundleName: 'scale',
    priceNote: 'one-time',
    defaultPriceKey: 'revealui_credits_scale',
    prices: [
      {
        key: 'revealui_credits_scale',
        unitAmount: 25000,
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
  revealui_enterprise_monthly: 'NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID',
  revealui_enterprise_yearly: 'NEXT_PUBLIC_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID',
  revealui_pro_perpetual: 'NEXT_PUBLIC_STRIPE_PRO_PERPETUAL_PRICE_ID',
  revealui_max_perpetual: 'NEXT_PUBLIC_STRIPE_MAX_PERPETUAL_PRICE_ID',
  revealui_enterprise_perpetual: 'NEXT_PUBLIC_STRIPE_ENTERPRISE_PERPETUAL_PRICE_ID',
};
export const PRICE_SERVER_ENV_KEYS: Record<string, string> = {
  revealui_pro_monthly: 'STRIPE_PRO_PRICE_ID',
  revealui_pro_yearly: 'STRIPE_PRO_ANNUAL_PRICE_ID',
  revealui_max_monthly: 'STRIPE_MAX_PRICE_ID',
  revealui_max_yearly: 'STRIPE_MAX_ANNUAL_PRICE_ID',
  revealui_enterprise_monthly: 'STRIPE_ENTERPRISE_PRICE_ID',
  revealui_enterprise_yearly: 'STRIPE_ENTERPRISE_ANNUAL_PRICE_ID',
  revealui_pro_perpetual: 'STRIPE_PERPETUAL_PRO_PRICE_ID',
  revealui_max_perpetual: 'STRIPE_PERPETUAL_MAX_PRICE_ID',
  revealui_enterprise_perpetual: 'STRIPE_PERPETUAL_ENTERPRISE_PRICE_ID',
  revealui_renewal_pro: 'STRIPE_RENEWAL_PRO_PRICE_ID',
  revealui_renewal_max: 'STRIPE_RENEWAL_MAX_PRICE_ID',
  revealui_renewal_enterprise: 'STRIPE_RENEWAL_ENTERPRISE_PRICE_ID',
  revealui_credits_starter: 'STRIPE_CREDITS_STARTER_PRICE_ID',
  revealui_credits_standard: 'STRIPE_CREDITS_STANDARD_PRICE_ID',
  revealui_credits_scale: 'STRIPE_CREDITS_SCALE_PRICE_ID',
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
