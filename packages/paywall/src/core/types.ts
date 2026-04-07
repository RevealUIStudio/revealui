/**
 * Core types for @revealui/paywall
 *
 * All types are generic over the consumer's tier and feature names.
 * This allows any SaaS to define its own tiers (e.g., 'starter', 'growth', 'scale')
 * and features (e.g., 'apiAccess', 'teamMembers', 'whiteLabel') without
 * being locked into RevealUI's specific tier names.
 */

/** A feature definition: its display label and the minimum tier required. */
export interface FeatureDefinition<TTier extends string> {
  tier: TTier;
  label: string;
  /** If true, this feature is planned but not yet implemented. Always returns false. */
  planned?: boolean;
}

/** Resource limit definition per tier. Use `Infinity` for unlimited. */
export type LimitDefinition<TTier extends string> = Record<TTier, number>;

/** Configuration for the license JWT cache. */
export interface LicenseCacheConfig {
  /** Time-to-live in milliseconds for the in-process cache. Default: 60000 (60s). */
  ttlMs?: number;
}

/** JWT license payload (decoded from the signed token). */
export interface LicensePayload<TTier extends string> {
  tier: TTier;
  customerId?: string;
  domains?: string[];
  perpetual?: boolean;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/** The full paywall configuration passed to `createPaywall()`. */
export interface PaywallConfig<TTier extends string = string, TFeature extends string = string> {
  /** Ordered list of tiers, lowest to highest. The first tier is the free/default tier. */
  tiers: readonly TTier[];
  /** Feature definitions: maps feature name → required tier + label. */
  features: Record<TFeature, FeatureDefinition<TTier>>;
  /** Resource limit definitions: maps limit name → per-tier values. */
  limits?: Record<string, LimitDefinition<TTier>>;
  /** License JWT configuration. */
  license?: {
    /** RSA public key (PEM) for JWT verification. */
    publicKey?: string;
    /** Cache configuration. */
    cache?: LicenseCacheConfig;
  };
}

/** The resolved state of the current license. */
export interface LicenseState<TTier extends string> {
  tier: TTier;
  payload: LicensePayload<TTier> | null;
  cachedAt: number;
}

/** Feature flags: a boolean map of feature names to enabled/disabled. */
export type FeatureFlags<TFeature extends string> = Record<TFeature, boolean>;

/** Result of a gate check. `null` means allowed; an object means denied. */
export interface GateDenial {
  feature?: string;
  requiredTier: string;
  currentTier: string;
  message: string;
}
