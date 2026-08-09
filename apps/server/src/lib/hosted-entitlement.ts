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
 * How an entitlement row was written (GAP-444 + GAP-256).
 * - `stripe` — webhook / checkout path (counts toward MRR)
 * - `grant` — admin CLI gift (excluded from MRR)
 * - `reconciler` — entitlement-consistency heal (counts as non-gift)
 * - `signup` — free@t0 or paid-pending at free/paid_signup (GAP-256; not reconciler)
 */
export type EntitlementSource = 'stripe' | 'grant' | 'reconciler' | 'signup';

/**
 * Known feature keys, derived from the canonical `FeatureFlags` record. Used
 * to warn on unexpected keys. Derived rather than listed: a hardcoded copy
 * drifted when vaultDesktop/vaultRotation/devkitProfiles shipped, making
 * every entitlement write log false unknown-key warnings.
 * `getFeaturesForTier` returns the complete record (false entries included),
 * so its keys are exactly `keyof FeatureFlags`.
 *
 * Derived LAZILY (memoized on first use), not at module load: an import-time
 * call breaks any test that partially mocks `@revealui/core/features` — the
 * mock factory runs before the test can extend it, and the whole importing
 * suite dies with "No getFeaturesForTier export is defined on the mock".
 */
let knownFeatureKeys: Set<string> | null = null;

function getKnownFeatureKeys(): Set<string> {
  knownFeatureKeys ??= new Set<string>(Object.keys(getFeaturesForTier('enterprise')));
  return knownFeatureKeys;
}

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
    if (!getKnownFeatureKeys().has(key)) {
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
  /** GAP-444 — defaults to stripe (paid path). CLI grants pass `grant`. */
  source?: EntitlementSource;
  /** Override limits (free cohort lean / paid-pending). Default: tier map. */
  limits?: ReturnType<typeof getHostedLimitsForTier>;
  /** Override features (paid-pending may zero AI). Default: getFeaturesForTier. */
  features?: Record<string, boolean>;
}): {
  planId: HostedTier;
  tier: HostedTier;
  status: string;
  features: Record<string, boolean>;
  limits: ReturnType<typeof getHostedLimitsForTier>;
  meteringStatus: string;
  mode: 'live' | 'test';
  source: EntitlementSource;
  graceUntil: Date | null;
  lastEventAt: Date | null;
  updatedAt: Date;
} {
  return {
    planId: params.tier,
    tier: params.tier,
    status: params.status,
    features: params.features ?? toFeatureRecord(getFeaturesForTier(params.tier)),
    limits: params.limits ?? getHostedLimitsForTier(params.tier),
    meteringStatus:
      params.status === 'active' || params.status === 'trialing' ? 'active' : 'paused',
    mode: params.mode,
    source: params.source ?? 'stripe',
    graceUntil: params.graceUntil ?? null,
    lastEventAt: params.lastEventAt,
    updatedAt: params.now,
  };
}

/** Existing entitlement row fields needed for free_preserve merge (K21). */
export interface AccountEntitlementMergeExisting {
  limits: ReturnType<typeof getHostedLimitsForTier> | Record<string, unknown>;
  source: EntitlementSource | string;
  cogsBreakerTrippedAt?: Date | null;
  cogsBreakerReason?: string | null;
  tier?: string;
}

export type MergeHostedEntitlementReason =
  | 'free_preserve'
  | 'paid_rebuild'
  | 'paid_pending_create'
  | 'breaker_clear';

/**
 * Single free-row merge helper (K21). All free writers must call this —
 * no raw `.set(values)` on free/signup rows without going through here.
 */
export function mergeHostedEntitlementUpdate(params: {
  existing: AccountEntitlementMergeExisting | null;
  next: ReturnType<typeof buildHostedEntitlementValues>;
  reason: MergeHostedEntitlementReason;
}): ReturnType<typeof buildHostedEntitlementValues> & {
  cogsBreakerTrippedAt: Date | null;
  cogsBreakerReason: string | null;
} {
  const { existing, next, reason } = params;

  if (reason === 'paid_rebuild') {
    return {
      ...next,
      cogsBreakerTrippedAt: null,
      cogsBreakerReason: null,
    };
  }

  if (reason === 'paid_pending_create') {
    return {
      ...next,
      source: 'signup',
      cogsBreakerTrippedAt: null,
      cogsBreakerReason: null,
    };
  }

  if (reason === 'breaker_clear') {
    return {
      ...next,
      cogsBreakerTrippedAt: null,
      cogsBreakerReason: null,
    };
  }

  // free_preserve: keep limits + breaker + signup source when healing free rows
  if (existing) {
    const keepSource =
      existing.source === 'signup' || existing.source === 'grant'
        ? (existing.source as EntitlementSource)
        : next.source;
    return {
      ...next,
      limits: existing.limits as ReturnType<typeof getHostedLimitsForTier>,
      source: keepSource === 'stripe' ? next.source : keepSource,
      cogsBreakerTrippedAt: existing.cogsBreakerTrippedAt ?? null,
      cogsBreakerReason: existing.cogsBreakerReason ?? null,
    };
  }

  // First free insert (no existing)
  return {
    ...next,
    cogsBreakerTrippedAt: null,
    cogsBreakerReason: null,
  };
}
