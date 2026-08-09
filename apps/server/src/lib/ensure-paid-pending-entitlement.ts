/**
 * GAP-256 PR-4b / K20 — paid-pending entitlement after paid_signup.
 *
 * Identity may exist for Stripe Checkout, but free AI must not open on abandon:
 * maxAgentTasks=0 and AI-bearing features forced off. Webhook paid_rebuild
 * replaces this row after successful payment (existing path).
 */

import { getFeaturesForTier } from '@revealui/core/features';
import { paidPendingLimits } from '@revealui/core/margin-governor';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { accountEntitlements, accountMemberships } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  buildHostedEntitlementValues,
  mergeHostedEntitlementUpdate,
  toFeatureRecord,
} from './hosted-entitlement.js';

/** Feature keys that must stay off while checkout is unpaid (K20). */
const AI_BEARING_FEATURE_KEYS = ['aiLocal', 'ai', 'aiMemory', 'aiInference'] as const;

/**
 * Free-tier feature map with every AI-bearing flag forced false.
 * Used only for paid-pending rows (not free cohort signup).
 */
export function buildPaidPendingFeatureMap(): Record<string, boolean> {
  const features = toFeatureRecord(getFeaturesForTier('free'));
  for (const key of AI_BEARING_FEATURE_KEYS) {
    features[key] = false;
  }
  return features;
}

export interface EnsurePaidPendingEntitlementParams {
  userId: string;
  displayName?: string;
  /** Intended paid tier after checkout (logged only; no metadata column). */
  pendingTier: 'pro' | 'max' | 'enterprise';
  now?: Date;
}

/**
 * Upsert free/signup entitlement with paidPendingLimits (maxAgentTasks=0).
 * Does not call freeCohortLimitsForMode or ensureFreeSignupEntitlement.
 */
export async function ensurePaidPendingEntitlement(
  params: EnsurePaidPendingEntitlementParams,
): Promise<{ accountId: string } | { skipped: true; reason: string }> {
  const { provisionHostedPersonalAccount } = await import('@revealui/auth/server');
  const provisioned = await provisionHostedPersonalAccount({
    userId: params.userId,
    displayName: params.displayName ?? 'RevealUI',
  });
  if ('skipped' in provisioned && provisioned.skipped) {
    if (provisioned.reason === 'not_hosted') {
      return provisioned;
    }
  }

  const db = getClient();
  const now = params.now ?? new Date();

  const [membership] = await db
    .select({ accountId: accountMemberships.accountId })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.userId, params.userId),
        eq(accountMemberships.role, 'owner'),
        eq(accountMemberships.status, 'active'),
      ),
    )
    .limit(1);

  if (!membership) {
    logger.warn('[paid-pending-entitlement] no owner membership; skip', {
      userId: params.userId,
    });
    return { skipped: true, reason: 'no_owner_membership' };
  }

  const accountId = membership.accountId;
  const [existing] = await db
    .select({
      source: accountEntitlements.source,
      limits: accountEntitlements.limits,
      cogsBreakerTrippedAt: accountEntitlements.cogsBreakerTrippedAt,
      cogsBreakerReason: accountEntitlements.cogsBreakerReason,
      tier: accountEntitlements.tier,
    })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.accountId, accountId))
    .limit(1);

  if (existing?.source === 'stripe' || existing?.source === 'grant') {
    logger.info('[paid-pending-entitlement] skip overwrite of paid/gifted row', {
      accountId,
      source: existing.source,
    });
    return { accountId };
  }

  const limits = paidPendingLimits();
  const next = buildHostedEntitlementValues({
    tier: 'free',
    status: 'active',
    mode: 'live',
    lastEventAt: null,
    now,
    source: 'signup',
    limits: {
      maxSites: limits.maxSites,
      maxUsers: limits.maxUsers,
      maxAgentTasks: limits.maxAgentTasks,
    },
    features: buildPaidPendingFeatureMap(),
  });

  const merged = mergeHostedEntitlementUpdate({
    existing: existing
      ? {
          limits: existing.limits,
          source: existing.source,
          cogsBreakerTrippedAt: existing.cogsBreakerTrippedAt,
          cogsBreakerReason: existing.cogsBreakerReason,
          tier: existing.tier,
        }
      : null,
    next,
    reason: 'paid_pending_create',
  });

  if (existing) {
    await db
      .update(accountEntitlements)
      .set({
        planId: merged.planId,
        tier: merged.tier,
        status: merged.status,
        features: merged.features,
        limits: merged.limits,
        meteringStatus: merged.meteringStatus,
        mode: merged.mode,
        source: merged.source,
        graceUntil: merged.graceUntil,
        lastEventAt: merged.lastEventAt,
        updatedAt: merged.updatedAt,
        cogsBreakerTrippedAt: merged.cogsBreakerTrippedAt,
        cogsBreakerReason: merged.cogsBreakerReason,
      })
      .where(eq(accountEntitlements.accountId, accountId));
  } else {
    await db.insert(accountEntitlements).values({
      accountId,
      planId: merged.planId,
      tier: merged.tier,
      status: merged.status,
      features: merged.features,
      limits: merged.limits,
      meteringStatus: merged.meteringStatus,
      mode: merged.mode,
      source: merged.source,
      graceUntil: merged.graceUntil,
      lastEventAt: merged.lastEventAt,
      updatedAt: merged.updatedAt,
      cogsBreakerTrippedAt: merged.cogsBreakerTrippedAt,
      cogsBreakerReason: merged.cogsBreakerReason,
    });
  }

  // No metadata jsonb on account_entitlements; pending tier is log-only.
  logger.info('[paid-pending-entitlement] upserted', {
    accountId,
    userId: params.userId,
    pendingTier: params.pendingTier,
    maxAgentTasks: merged.limits.maxAgentTasks,
  });

  return { accountId };
}
