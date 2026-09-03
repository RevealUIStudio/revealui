import type { LicenseTierId } from '@revealui/contracts/public-catalog';

/**
 * Client-side display fallback prices — used by PricingPage and PricingTeaser
 * when /api/pricing is unreachable. Must stay in lockstep with:
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
