import type { LicenseTierId } from '@revealui/contracts/pricing';

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
  max: { price: '$299', period: '/month' },
  enterprise: { price: '$1,499', period: '/month' },
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
  'Agency Perpetual': {
    price: '$8,499',
    priceNote: 'one-time',
    renewal: '$799/yr for continued support',
  },
  'Enterprise Perpetual': {
    price: '$42,999',
    priceNote: 'one-time',
    renewal: '$3,999/yr for continued support',
  },
};
