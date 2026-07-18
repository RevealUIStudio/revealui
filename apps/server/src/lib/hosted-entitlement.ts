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

import { getFeaturesForTier } from '@revealui/core/features';
import type { LicenseTier } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import { getHostedLimitsForTier } from './tier-limits.js';

/** Hosted tiers. `free` is not a `LicenseTier` but is a valid entitlement tier. */
export type HostedTier = 'free' | LicenseTier;

/**
 * Known feature keys, derived from the canonical `FeatureFlags` record at
 * module load. Used to warn on unexpected keys. Derived rather than listed:
 * a hardcoded copy drifted when vaultDesktop/vaultRotation/devkitProfiles
 * shipped, making every entitlement write log false unknown-key warnings.
 * `getFeaturesForTier` returns the complete record (false entries included),
 * so its keys are exactly `keyof FeatureFlags`.
 */
const KNOWN_FEATURE_KEYS = new Set<string>(Object.keys(getFeaturesForTier('enterprise')));

export function coerceHostedTier(value: string | null | undefined): HostedTier | undefined {
  if (value === 'free' || value === 'pro' || value === 'max' || value === 'enterprise') {
    return value;
  }
  return undefined;
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
 * `lastEventAt` is the event-to-event staleness cursor (F2).
 *
 * The webhook path passes `event.created`. The reconciler passes `null` **only
 * when INSERTing** a brand-new row, so the next webhook wins over a synthesized
 * one. It must NOT null the cursor on an UPDATE: the guard is
 * `last_event_at IS NULL OR last_event_at < event.created`, so NULL lets *any*
 * event win — including a stale one. `drain-unreconciled` replays old events
 * with their original `created`, so nulling an existing cursor would re-open the
 * out-of-order window PR-1 closed. On an update the caller preserves the
 * existing cursor.
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
