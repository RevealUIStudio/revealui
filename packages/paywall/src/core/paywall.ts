/**
 * Paywall factory — `createPaywall()`.
 *
 * Creates a configured paywall instance with all enforcement functions
 * bound to your tier hierarchy, feature definitions, and limits.
 *
 * @example Zero-config (uses sensible SaaS defaults):
 * ```ts
 * import { createPaywall } from '@revealui/paywall';
 * const paywall = createPaywall();
 * ```
 *
 * @example Custom tiers and features:
 * ```ts
 * const paywall = createPaywall({
 *   tiers: ['starter', 'growth', 'scale'],
 *   features: {
 *     apiAccess: { tier: 'starter', label: 'API Access' },
 *     teamMembers: { tier: 'growth', label: 'Team Members' },
 *     whiteLabel: { tier: 'scale', label: 'White Label' },
 *   },
 *   limits: {
 *     seats: { starter: 1, growth: 10, scale: Infinity },
 *   },
 * });
 * ```
 */

import { DEFAULT_CONFIG, type DefaultTier } from './defaults.js';
import {
  getFeatureLabel,
  getFeaturesForTier,
  getRequiredTier,
  isFeatureEnabled,
} from './features.js';
import { getLimit, isOverLimit } from './limits.js';
import { buildTierRanks, tierMeetsRequirement } from './tiers.js';
import type {
  FeatureDefinition,
  FeatureFlags,
  GateDenial,
  LimitDefinition,
  PaywallConfig,
} from './types.js';

/** The paywall instance returned by `createPaywall()`. */
export interface Paywall<TTier extends string = string, TFeature extends string = string> {
  /** The configured tiers in rank order. */
  readonly tiers: readonly TTier[];

  /** The default (free/lowest) tier. */
  readonly defaultTier: TTier;

  /** Check if `currentTier` meets or exceeds `requiredTier`. */
  isLicensed(currentTier: TTier, requiredTier: TTier): boolean;

  /** Check if a feature is enabled at the given tier. */
  isFeatureEnabled(currentTier: TTier, feature: TFeature): boolean;

  /** Get all feature flags for a tier. */
  getFeaturesForTier(tier: TTier): FeatureFlags<TFeature>;

  /** Get the minimum tier required for a feature. */
  getRequiredTier(feature: TFeature): TTier | undefined;

  /** Get the display label for a feature. */
  getFeatureLabel(feature: TFeature): string;

  /** Get the limit for a resource at a given tier. */
  getLimit(resource: string, tier: TTier): number;

  /** Check if usage exceeds the limit. */
  isOverLimit(resource: string, tier: TTier, currentUsage: number): boolean;

  /**
   * Gate check: returns `null` if allowed, or a `GateDenial` if denied.
   * Useful for building custom middleware or UI gates.
   */
  checkFeature(currentTier: TTier, feature: TFeature): GateDenial | null;

  /**
   * Gate check for tier: returns `null` if allowed, or a `GateDenial` if denied.
   */
  checkTier(currentTier: TTier, requiredTier: TTier): GateDenial | null;

  /** The raw configuration. */
  readonly config: PaywallConfig<TTier, TFeature>;
}

/**
 * Create a paywall instance.
 *
 * With no arguments, uses sensible SaaS defaults:
 * - Tiers: free → pro → max → enterprise
 * - 12 features with standard tier assignments
 * - Resource limits for sites, users, tasks
 *
 * Pass a partial config to override any part.
 */
export function createPaywall<TTier extends string = DefaultTier, TFeature extends string = string>(
  config?: Partial<PaywallConfig<TTier, TFeature>>,
): Paywall<TTier, TFeature> {
  const resolved: PaywallConfig<TTier, TFeature> = {
    tiers: (config?.tiers ?? DEFAULT_CONFIG.tiers) as readonly TTier[],
    features: (config?.features ?? DEFAULT_CONFIG.features) as Record<
      TFeature,
      FeatureDefinition<TTier>
    >,
    limits: (config?.limits ?? DEFAULT_CONFIG.limits) as
      | Record<string, LimitDefinition<TTier>>
      | undefined,
    license: {
      ...DEFAULT_CONFIG.license,
      ...config?.license,
      cache: {
        ...DEFAULT_CONFIG.license?.cache,
        ...config?.license?.cache,
      },
    },
  };

  const ranks = buildTierRanks(resolved.tiers);
  const features = resolved.features;
  const limits = resolved.limits ?? {};
  const defaultTier = resolved.tiers[0] as TTier;

  return {
    tiers: resolved.tiers,
    defaultTier,
    config: resolved,

    isLicensed(currentTier: TTier, requiredTier: TTier): boolean {
      return tierMeetsRequirement(ranks, currentTier, requiredTier);
    },

    isFeatureEnabled(currentTier: TTier, feature: TFeature): boolean {
      return isFeatureEnabled(ranks, features, currentTier, feature as string);
    },

    getFeaturesForTier(tier: TTier): FeatureFlags<TFeature> {
      return getFeaturesForTier(ranks, features, tier) as FeatureFlags<TFeature>;
    },

    getRequiredTier(feature: TFeature): TTier | undefined {
      return getRequiredTier(features, feature as string);
    },

    getFeatureLabel(feature: TFeature): string {
      return getFeatureLabel(features, feature as string);
    },

    getLimit(resource: string, tier: TTier): number {
      return getLimit(limits, resource, tier);
    },

    isOverLimit(resource: string, tier: TTier, currentUsage: number): boolean {
      return isOverLimit(limits, resource, tier, currentUsage);
    },

    checkFeature(currentTier: TTier, feature: TFeature): GateDenial | null {
      if (isFeatureEnabled(ranks, features, currentTier, feature as string)) {
        return null;
      }
      const required = getRequiredTier(features, feature as string);
      const label = getFeatureLabel(features, feature as string);
      return {
        feature: feature as string,
        requiredTier: required ?? 'unknown',
        currentTier,
        message: `${label} requires a ${required ?? 'higher'} plan`,
      };
    },

    checkTier(currentTier: TTier, requiredTier: TTier): GateDenial | null {
      if (tierMeetsRequirement(ranks, currentTier, requiredTier)) {
        return null;
      }
      return {
        requiredTier,
        currentTier,
        message: `This action requires a ${requiredTier} plan`,
      };
    },
  };
}
