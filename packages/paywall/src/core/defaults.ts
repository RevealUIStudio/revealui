/**
 * Sensible defaults for common SaaS applications.
 *
 * `createPaywall()` with no arguments uses these defaults.
 * Override any part by passing your own config.
 */

import type { FeatureDefinition, LimitDefinition, PaywallConfig } from './types.js';

/** Standard SaaS tiers. Override with your own if needed. */
export const DEFAULT_TIERS = ['free', 'pro', 'max', 'enterprise'] as const;
export type DefaultTier = (typeof DEFAULT_TIERS)[number];

/** Standard SaaS features with sensible tier assignments. */
export const DEFAULT_FEATURES: Record<string, FeatureDefinition<DefaultTier>> = {
  // --- Free tier (available to everyone) ---
  aiLocal: { tier: 'free', label: 'Local AI Inference' },

  // --- Pro tier ---
  ai: { tier: 'pro', label: 'AI Agents' },
  payments: { tier: 'pro', label: 'Payment Processing' },
  analytics: { tier: 'pro', label: 'Analytics' },
  customDomain: { tier: 'pro', label: 'Custom Domain' },
  dashboard: { tier: 'pro', label: 'Monitoring Dashboard' },
  advancedSync: { tier: 'pro', label: 'Real-Time Sync' },

  // --- Max tier ---
  aiMemory: { tier: 'max', label: 'AI Memory System' },
  auditLog: { tier: 'max', label: 'Audit Logging' },

  // --- Enterprise tier ---
  multiTenant: { tier: 'enterprise', label: 'Multi-Tenant' },
  whiteLabel: { tier: 'enterprise', label: 'White Label', planned: true },
  sso: { tier: 'enterprise', label: 'SSO / SAML', planned: true },
};

/** Standard resource limits. */
export const DEFAULT_LIMITS: Record<string, LimitDefinition<DefaultTier>> = {
  sites: { free: 1, pro: 5, max: 15, enterprise: Infinity },
  users: { free: 3, pro: 25, max: 100, enterprise: Infinity },
  tasksPerMonth: { free: 1_000, pro: 10_000, max: 50_000, enterprise: Infinity },
};

/** Default cache TTL: 60 seconds. Fast enough for revocation, slow enough for performance. */
export const DEFAULT_CACHE_TTL_MS = 60_000;

/** The complete default config. */
export const DEFAULT_CONFIG: PaywallConfig<DefaultTier, string> = {
  tiers: DEFAULT_TIERS,
  features: DEFAULT_FEATURES,
  limits: DEFAULT_LIMITS,
  license: {
    cache: { ttlMs: DEFAULT_CACHE_TTL_MS },
  },
};
