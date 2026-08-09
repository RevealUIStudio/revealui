/**
 * Whether the sidebar "Upgrade" item should show.
 *
 * Mirrors commercial ladder free < pro < max < enterprise (see
 * `@revealui/contracts/pricing` TIER_RANK / getTiersFromCurrent). Enterprise
 * is the top grant (founder / operator) — no higher plan, no Upgrade nav.
 * Fleet kits never show Stripe upgrade. While tier is loading or resolution
 * failed, hide upsell (GAP-454: do not invent free/upsell on unknown).
 */

const TIER_RANK = {
  free: 0,
  pro: 1,
  max: 2,
  enterprise: 3,
} as const;

/** Enterprise is the commercial top; no higher plan to upsell into. */
const TOP_RANK: number = TIER_RANK.enterprise;

export function shouldShowUpgradeNavItem(
  tier: string,
  options: {
    isFleetMode: boolean;
    isLoading: boolean;
    resolveError: unknown;
  },
): boolean {
  if (options.isFleetMode) return false;
  if (options.isLoading || options.resolveError) return false;
  if (!(tier in TIER_RANK)) return false;
  const rank = TIER_RANK[tier as keyof typeof TIER_RANK];
  return rank < TOP_RANK;
}
