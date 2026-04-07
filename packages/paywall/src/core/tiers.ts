/**
 * Tier comparison utilities.
 *
 * Tiers are ordered by their position in the config array.
 * The first tier is rank 0 (free/lowest), the last is the highest.
 */

/** Build a rank map from an ordered tier list. */
export function buildTierRanks<TTier extends string>(tiers: readonly TTier[]): Map<TTier, number> {
  const ranks = new Map<TTier, number>();
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i] as TTier;
    ranks.set(tier, i);
  }
  return ranks;
}

/** Check if `currentTier` meets or exceeds `requiredTier`. */
export function tierMeetsRequirement<TTier extends string>(
  ranks: Map<TTier, number>,
  currentTier: TTier,
  requiredTier: TTier,
): boolean {
  const current = ranks.get(currentTier);
  const required = ranks.get(requiredTier);
  if (current === undefined || required === undefined) return false;
  return current >= required;
}

/** Get the rank of a tier. Returns -1 if unknown. */
export function getTierRank<TTier extends string>(ranks: Map<TTier, number>, tier: TTier): number {
  return ranks.get(tier) ?? -1;
}
