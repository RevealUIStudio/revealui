/**
 * Hosted entitlement value construction — the single source of truth for what
 * an `account_entitlements` row looks like for a given tier.
 *
 * Extracted from `routes/webhooks.ts` (GAP-356 PR-2) so the webhook write path
 * and the entitlement-consistency reconciler cannot drift apart. Two copies of
 * the tier→features/limits mapping is exactly the class of bug GAP-356 is: a
 * heal that grants a *different* feature set than the webhook would have
 * granted is worse than no heal at all, because it looks correct.
 *
 * Pure. No DB, no Stripe, no I/O beyond a warn log on an unknown feature key.
 */

import { type FeatureFlags, getFeaturesForTier } from '@revealui/core/features';
import type { LicenseTier } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import { getHostedLimitsForTier } from './tier-limits.js';

/** Hosted tiers. `free` is not a `LicenseTier` but is a valid entitlement tier. */
export type HostedTier = 'free' | LicenseTier;

/** Known feature keys from {@link FeatureFlags}. Used to warn on unexpected keys. */
const KNOWN_FEATURE_KEYS = new Set<string>([
  'aiLocal',
  'ai',
  'aiMemory',
  'mcp',
  'payments',
  'multiTenant',
  'whiteLabel',
  'aiInference',
  'auditLog',
  'advancedSync',
  'dashboard',
  'customDomain',
  'analytics',
] satisfies (keyof FeatureFlags)[]);

/**
 * Tier ordering, low to high. Used by the reconciler's monotonic-upward heal
 * guard: a heal may raise a tier but must never lower one, because a downgrade
 * is a real business decision that belongs to the (signature-verified) webhook
 * path, not to a cron inferring state from local rows.
 */
const TIER_RANK: Record<HostedTier, number> = {
  free: 0,
  pro: 1,
  max: 2,
  enterprise: 3,
};

export function coerceHostedTier(value: string | null | undefined): HostedTier | undefined {
  if (value === 'free' || value === 'pro' || value === 'max' || value === 'enterprise') {
    return value;
  }
  return undefined;
}

/** True when `next` is strictly higher than `current`. Equal tiers are NOT an upgrade. */
export function isTierUpgrade(current: HostedTier, next: HostedTier): boolean {
  return TIER_RANK[next] > TIER_RANK[current];
}

export function toFeatureRecord(features: object | null | undefined): Record<string, boolean> {
  if (!features) {
    return {};
  }

  const entries = Object.entries(features).filter(
    (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
  );

  for (const [key] of entries) {
    if (!KNOWN_FEATURE_KEYS.has(key)) {
      logger.warn('Unknown feature key encountered in toFeatureRecord', { key });
    }
  }

  return Object.fromEntries(entries);
}

/**
 * The `account_entitlements` column values for a tier + status.
 *
 * `lastEventAt` is the event-to-event staleness cursor (F2). The reconciler
 * passes `null` deliberately: a healed row carries no event provenance, so the
 * very next webhook — whatever its `event.created` — must win over it. A healed
 * row must never be able to make a real event look stale.
 */
export function buildHostedEntitlementValues(params: {
  tier: HostedTier;
  status: string;
  mode: 'live' | 'test';
  graceUntil?: Date | null;
  lastEventAt: Date | null;
  now: Date;
}): {
  planId: HostedTier;
  tier: HostedTier;
  status: string;
  features: Record<string, boolean>;
  limits: ReturnType<typeof getHostedLimitsForTier>;
  meteringStatus: string;
  mode: 'live' | 'test';
  graceUntil: Date | null;
  lastEventAt: Date | null;
  updatedAt: Date;
} {
  return {
    planId: params.tier,
    tier: params.tier,
    status: params.status,
    features: toFeatureRecord(getFeaturesForTier(params.tier)),
    limits: getHostedLimitsForTier(params.tier),
    meteringStatus:
      params.status === 'active' || params.status === 'trialing' ? 'active' : 'paused',
    mode: params.mode,
    graceUntil: params.graceUntil ?? null,
    lastEventAt: params.lastEventAt,
    updatedAt: params.now,
  };
}
