/**
 * GAP-256 PR-3 — free entitlement@t0 after hosted signup (K15).
 *
 * Finds the personal account for the new user and upserts account_entitlements
 * with source=signup and cohort limits from admit.
 */

import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import type { CohortLimits } from '@revealui/core/margin-governor';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { accountEntitlements, accountMemberships } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  buildHostedEntitlementValues,
  mergeHostedEntitlementUpdate,
} from './hosted-entitlement.js';

export async function ensureFreeSignupEntitlement(params: {
  userId: string;
  cohortLimits: CohortLimits;
  now?: Date;
}): Promise<{ accountId: string } | { skipped: true; reason: string }> {
  const db = getClient();
  const now = params.now ?? new Date();

  const [membership] = await db
    .select({
      accountId: accountMemberships.accountId,
    })
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
    logger.warn('[free-signup-entitlement] no owner membership; skip', {
      userId: params.userId,
    });
    return { skipped: true, reason: 'no_owner_membership' };
  }

  const accountId = membership.accountId;
  const [existing] = await db
    .select({
      limits: accountEntitlements.limits,
      source: accountEntitlements.source,
      cogsBreakerTrippedAt: accountEntitlements.cogsBreakerTrippedAt,
      cogsBreakerReason: accountEntitlements.cogsBreakerReason,
      tier: accountEntitlements.tier,
    })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.accountId, accountId))
    .limit(1);

  const next = buildHostedEntitlementValues({
    tier: 'free',
    status: 'active',
    mode: getConfiguredStripeMode() === 'test' ? 'test' : 'live',
    lastEventAt: null,
    now,
    source: 'signup',
    limits: {
      maxSites: params.cohortLimits.maxSites,
      maxUsers: params.cohortLimits.maxUsers,
      maxAgentTasks: params.cohortLimits.maxAgentTasks,
    },
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
    reason: existing ? 'free_preserve' : 'free_preserve',
  });

  // First insert: use next limits (free_preserve with null existing returns next)
  const row = {
    accountId,
    planId: merged.planId,
    tier: merged.tier,
    status: merged.status,
    features: merged.features,
    limits: existing ? merged.limits : next.limits,
    meteringStatus: merged.meteringStatus,
    mode: merged.mode,
    source: 'signup' as const,
    graceUntil: merged.graceUntil,
    lastEventAt: merged.lastEventAt,
    updatedAt: merged.updatedAt,
    cogsBreakerTrippedAt: merged.cogsBreakerTrippedAt,
    cogsBreakerReason: merged.cogsBreakerReason,
  };

  if (existing) {
    // free_preserve keeps old limits — for first signup after race, still ok
    await db
      .update(accountEntitlements)
      .set({
        ...row,
        // Only set signup source if not paid
        source:
          existing.source === 'stripe' || existing.source === 'grant' ? existing.source : 'signup',
      })
      .where(eq(accountEntitlements.accountId, accountId));
  } else {
    await db.insert(accountEntitlements).values(row);
  }

  logger.info('[free-signup-entitlement] upserted', {
    accountId,
    userId: params.userId,
    maxAgentTasks: params.cohortLimits.maxAgentTasks,
  });

  return { accountId };
}
