/**
 * Feature flag system for RevealUI Pro/Enterprise tiers.
 *
 * Gates premium features based on the current license tier.
 * Free (OSS) users get the core CMS framework.
 * Pro/Enterprise users unlock AI, advanced sync, dashboard, etc.
 *
 * @dependencies
 * - ./license.ts - License validation and tier checking
 */

import { isLicensed, type LicenseTier } from './license.js';

/** All gated features in RevealUI */
export interface FeatureFlags {
  /** Local AI inference via BitNet — available at all tiers (no API key needed) */
  aiLocal: boolean;
  /** AI agent system — local + cloud via RevealUI harness (Pro+) */
  ai: boolean;
  /** AI memory system — working + episodic + vector (Max: basic, Enterprise: full) */
  aiMemory: boolean;
  /** MCP server integration */
  mcp: boolean;
  /** Built-in Stripe payment processing */
  payments: boolean;
  /** Multi-tenant site management */
  multiTenant: boolean;
  /** White-label admin dashboard (planned — not yet implemented) */
  whiteLabel: boolean;
  /** SSO/SAML authentication (planned — not yet implemented) */
  sso: boolean;
  /** Open-model inference configuration — snaps, BitNet, harness (Max+) */
  aiInference: boolean;
  /** Audit logging and compliance trail */
  auditLog: boolean;
  /** Full real-time sync with conflict resolution */
  advancedSync: boolean;
  /** Monitoring dashboard */
  dashboard: boolean;
  /** Custom domain mapping */
  customDomain: boolean;
  /** Analytics and conversion tracking */
  analytics: boolean;
  /** RevVault desktop app — Tauri companion for encrypted secret management (Pro+) */
  vaultDesktop: boolean;
  /** RevVault rotation engine — automated credential lifecycle (Pro+) */
  vaultRotation: boolean;
  /** RevKit environment provisioning — tiered dev profiles (Max+) */
  devkitProfiles: boolean;
}

/** Feature-to-tier mapping: minimum tier required for each feature */
const featureTierMap: Record<keyof FeatureFlags, LicenseTier> = {
  aiLocal: 'free',
  ai: 'pro',
  mcp: 'pro',
  payments: 'pro',
  advancedSync: 'pro',
  dashboard: 'pro',
  customDomain: 'pro',
  analytics: 'pro',
  aiMemory: 'max',
  aiInference: 'max',
  auditLog: 'max',
  multiTenant: 'enterprise',
  // NOTE: whiteLabel and sso are planned but not yet implemented.
  // Forced to false below in getFeatures/getFeaturesForTier/isFeatureEnabled
  // to avoid advertising features that don't exist. Re-enable when implemented.
  whiteLabel: 'enterprise',
  sso: 'enterprise',
  vaultDesktop: 'pro',
  vaultRotation: 'pro',
  devkitProfiles: 'max',
};

/**
 * Returns the current feature flags based on the active license tier.
 *
 * @example
 * ```typescript
 * import { getFeatures } from '@revealui/core/features'
 *
 * const features = getFeatures()
 * if (features.ai) {
 *   // Enable AI agent system
 * }
 * ```
 */
export function getFeatures(): FeatureFlags {
  const flags = {} as FeatureFlags;

  for (const [feature, requiredTier] of Object.entries(featureTierMap)) {
    flags[feature as keyof FeatureFlags] = isLicensed(requiredTier);
  }

  // Planned but not yet implemented — force false to avoid false advertising
  flags.whiteLabel = false;
  flags.sso = false;

  return flags;
}

/**
 * Check if a specific feature is enabled.
 *
 * @example
 * ```typescript
 * import { isFeatureEnabled } from '@revealui/core/features'
 *
 * if (isFeatureEnabled('ai')) {
 *   // AI is available
 * }
 * ```
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  // Planned but not yet implemented — always return false
  if (feature === 'whiteLabel' || feature === 'sso') return false;

  const requiredTier = featureTierMap[feature];
  return isLicensed(requiredTier);
}

/**
 * Returns all features available at a given tier (useful for pricing pages).
 */
export function getFeaturesForTier(tier: LicenseTier): FeatureFlags {
  const tierRank: Record<LicenseTier, number> = {
    free: 0,
    pro: 1,
    max: 2,
    enterprise: 3,
  };

  const flags = {} as FeatureFlags;

  for (const [feature, requiredTier] of Object.entries(featureTierMap)) {
    flags[feature as keyof FeatureFlags] = tierRank[tier] >= tierRank[requiredTier];
  }

  // Planned but not yet implemented — force false to avoid false advertising
  flags.whiteLabel = false;
  flags.sso = false;

  return flags;
}

/**
 * Returns the minimum tier required for a given feature.
 */
export function getRequiredTier(feature: keyof FeatureFlags): LicenseTier {
  return featureTierMap[feature];
}

/**
 * Returns the current license tier. Convenience re-export.
 */
export { getCurrentTier } from './license.js';
