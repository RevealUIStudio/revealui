/**
 * Feature registry — resolves feature flags based on tier.
 */

import { tierMeetsRequirement } from './tiers.js';
import type { FeatureDefinition, FeatureFlags } from './types.js';

/**
 * Check if a single feature is enabled at the given tier.
 */
export function isFeatureEnabled<TTier extends string>(
  ranks: Map<TTier, number>,
  features: Record<string, FeatureDefinition<TTier>>,
  currentTier: TTier,
  feature: string,
): boolean {
  const def = features[feature];
  if (!def) return false;
  if (def.planned) return false;
  return tierMeetsRequirement(ranks, currentTier, def.tier);
}

/**
 * Get all feature flags for a given tier.
 */
export function getFeaturesForTier<TTier extends string>(
  ranks: Map<TTier, number>,
  features: Record<string, FeatureDefinition<TTier>>,
  tier: TTier,
): FeatureFlags<string> {
  const flags: Record<string, boolean> = {};
  for (const [name, def] of Object.entries(features)) {
    if (def.planned) {
      flags[name] = false;
    } else {
      flags[name] = tierMeetsRequirement(ranks, tier, def.tier);
    }
  }
  return flags as FeatureFlags<string>;
}

/**
 * Get the minimum tier required for a feature.
 * Returns undefined if the feature is not defined.
 */
export function getRequiredTier<TTier extends string>(
  features: Record<string, FeatureDefinition<TTier>>,
  feature: string,
): TTier | undefined {
  return features[feature]?.tier;
}

/**
 * Get the label for a feature.
 */
export function getFeatureLabel(
  features: Record<string, FeatureDefinition<string>>,
  feature: string,
): string {
  return features[feature]?.label ?? feature;
}
