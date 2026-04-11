/**
 * @revealui/paywall
 *
 * Runtime license enforcement, feature gating, and upgrade UI for software products.
 *
 * Zero-config defaults for the common case; fully configurable for custom tiers and features.
 *
 * @example Quick start:
 * ```ts
 * import { createPaywall } from '@revealui/paywall';
 *
 * // Uses sensible defaults: free → pro → max → enterprise
 * const paywall = createPaywall();
 *
 * paywall.isFeatureEnabled('pro', 'ai');        // true
 * paywall.isFeatureEnabled('free', 'ai');       // false
 * paywall.checkFeature('free', 'ai');           // { message: 'AI Agents requires a pro plan', ... }
 * paywall.getFeaturesForTier('pro');            // { aiLocal: true, ai: true, payments: true, ... }
 * paywall.getLimit('sites', 'pro');             // 5
 * paywall.isOverLimit('users', 'free', 4);     // true (limit is 3)
 * ```
 *
 * @example Custom tiers:
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
 *
 * Subpath exports:
 * - `@revealui/paywall/server/hono`  -  Hono middleware
 * - `@revealui/paywall/server/next`  -  Next.js route handler gates
 * - `@revealui/paywall/client`  -  React components (LicenseGate, UpgradePrompt)
 * - `@revealui/paywall/stripe`  -  Stripe webhook/checkout helpers
 * - `@revealui/paywall/x402`  -  HTTP 402 agent payment negotiation
 *
 * @packageDocumentation
 */

// Defaults (for extending or inspecting)
export {
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_CONFIG,
  DEFAULT_FEATURES,
  DEFAULT_LIMITS,
  DEFAULT_TIERS,
  type DefaultTier,
} from './core/defaults.js';
// Core factory
export { createPaywall, type Paywall } from './core/paywall.js';
// Tier utilities
export { buildTierRanks, getTierRank, tierMeetsRequirement } from './core/tiers.js';
// Types
export type {
  FeatureDefinition,
  FeatureFlags,
  GateDenial,
  LicenseCacheConfig,
  LicensePayload,
  LicenseState,
  LimitDefinition,
  PaywallConfig,
} from './core/types.js';
