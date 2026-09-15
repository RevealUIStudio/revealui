import type { LicenseTierId } from '@revealui/contracts/public-catalog';

/**
 * Client-side display catalog prices — used by PricingPage and PricingTeaser.
 * Free/Pro/Max amounts win over /api/pricing when both exist so a stale Stripe
 * deploy cannot paint a different public price. Must stay in lockstep with:
 *   - apps/server/src/routes/pricing.ts HARDCODED_*_PRICES (server fallback)
 *   - apps/server/src/lib/tier-pricing.ts MRR_TIER_PRICE_FALLBACK_USD
 *   - offerings-canonical.md (canonical source, pinned 2026-06-07)
 *   - apps/marketing/app/__tests__/pricing-fallbacks.test.ts (drift gate)
 *
 * Update all surfaces together when prices change.
 */

export const SUBSCRIPTION_PRICE_FALLBACKS: Record<
  LicenseTierId,
  { price: string; period?: string }
> = {
  free: { price: '$0' },
  pro: { price: '$49', period: '/month' },
  max: { price: '$99', period: '/month' },
  enterprise: { price: 'Contact sales' },
};

export const ANNUAL_SUBSCRIPTION_PRICE_FALLBACKS: Record<
  LicenseTierId,
  { price: string; period: string }
> = {
  free: { price: '$0', period: '/year' },
  pro: { price: '$399', period: '/year' },
  max: { price: '$799', period: '/year' },
  enterprise: { price: 'Contact sales', period: '/year' },
};

export const PERPETUAL_PRICE_FALLBACKS: Record<
  string,
  { price: string; priceNote: string; renewal: string }
> = {
  'Pro Perpetual': {
    price: '$1,499',
    priceNote: 'one-time',
    renewal: '$149/yr for continued support',
  },
};

export interface PublicCatalogApiAmount {
  price?: string;
  period?: string;
  annualPrice?: string;
  annualPeriod?: string;
}

export interface PublicCatalogDisplayAmount {
  price?: string;
  period?: string;
  annualPrice?: string;
  annualPeriod?: string;
}

const LOCKED_PUBLIC_CATALOG_TIER_IDS = new Set<LicenseTierId>(['free', 'pro', 'max']);

/**
 * Public Free/Pro/Max amounts are locked in marketing fallbacks. A stale
 * /api/pricing or Stripe deploy must not paint a different catalog price.
 * Enterprise stays inquire-only (no unit amount).
 */
export function resolvePublicCatalogDisplayAmount(
  tierId: LicenseTierId,
  fromApi?: PublicCatalogApiAmount,
): PublicCatalogDisplayAmount {
  if (tierId === 'enterprise') {
    return {};
  }

  const monthlyFallback = SUBSCRIPTION_PRICE_FALLBACKS[tierId];
  const annualFallback = ANNUAL_SUBSCRIPTION_PRICE_FALLBACKS[tierId];

  if (LOCKED_PUBLIC_CATALOG_TIER_IDS.has(tierId)) {
    return {
      price: monthlyFallback.price,
      period: monthlyFallback.period,
      annualPrice: annualFallback.price,
      annualPeriod: annualFallback.period,
    };
  }

  return {
    price: fromApi?.price ?? monthlyFallback.price,
    period: fromApi?.period ?? monthlyFallback.period,
    annualPrice: fromApi?.annualPrice ?? annualFallback.price,
    annualPeriod: fromApi?.annualPeriod ?? annualFallback.period,
  };
}
