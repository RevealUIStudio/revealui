/**
 * Request-scoped account entitlements middleware.
 *
 * This is an additive bridge toward account-level hosted entitlements.
 * It does not replace legacy license gates yet. It attaches the best-known
 * account, membership, and entitlement context to the request.
 */

import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import { getFeaturesForTier } from '@revealui/core/features';
import { getClient } from '@revealui/db';
import { accountEntitlements, accountMemberships } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';

export interface EntitlementContext {
  userId: string | null;
  accountId: string | null;
  membershipRole: string | null;
  subscriptionStatus: string | null;
  /**
   * When the paid grace window ends for a degraded subscription (past_due /
   * canceled / revoked). Null when there is no grace window. Read at request
   * time so enforcement does not depend on the sweep-grace-periods cron.
   */
  graceUntil: Date | null;
  tier: 'free' | 'pro' | 'max' | 'enterprise';
  features: Record<string, boolean>;
  limits: {
    maxSites?: number;
    maxUsers?: number;
    maxAgentTasks?: number;
  };
  resolvedAt: Date;
}

function toFeatureRecord(features: object | null | undefined): Record<string, boolean> {
  if (!features) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(features).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
    ),
  );
}

function createFreeEntitlements(userId: string | null): EntitlementContext {
  return {
    userId,
    accountId: null,
    membershipRole: null,
    subscriptionStatus: null,
    graceUntil: null,
    tier: 'free',
    features: {},
    limits: {},
    resolvedAt: new Date(),
  };
}

/**
 * A subscription status that still confers the paid tier. Anything else is a
 * degraded state (past_due / canceled / revoked / expired) that only retains
 * access while inside the grace window.
 */
function isHealthyStatus(status: string | null): boolean {
  return status === 'active' || status === 'trialing';
}

export const entitlementMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get('user') as { id?: string } | undefined;
    const userId = user?.id ?? null;

    if (!userId) {
      c.set('entitlements', createFreeEntitlements(null));
      await next();
      return;
    }

    const db = getClient();
    const [membership] = await db
      .select({
        accountId: accountMemberships.accountId,
        role: accountMemberships.role,
      })
      .from(accountMemberships)
      .where(and(eq(accountMemberships.userId, userId), eq(accountMemberships.status, 'active')))
      .limit(1);

    if (!membership?.accountId) {
      c.set('entitlements', createFreeEntitlements(userId));
      await next();
      return;
    }

    const [entitlement] = await db
      .select({
        tier: accountEntitlements.tier,
        status: accountEntitlements.status,
        graceUntil: accountEntitlements.graceUntil,
        features: accountEntitlements.features,
        limits: accountEntitlements.limits,
        cogsBreakerTrippedAt: accountEntitlements.cogsBreakerTrippedAt,
      })
      .from(accountEntitlements)
      .where(
        and(
          eq(accountEntitlements.accountId, membership.accountId),
          eq(accountEntitlements.mode, getConfiguredStripeMode()),
        ),
      )
      .limit(1);

    const status = entitlement?.status ?? null;
    const graceUntil = entitlement?.graceUntil ?? null;
    const graceActive = graceUntil != null && graceUntil.getTime() > Date.now();
    const rawTier = (entitlement?.tier as EntitlementContext['tier'] | undefined) ?? 'free';

    // Request-time fail-safe: a degraded subscription (not active/trialing) whose
    // grace window has passed (or was never set) is treated as free HERE, without
    // waiting for the sweep-grace-periods cron to flip the row. This prevents a
    // delinquent account from retaining paid features indefinitely if the cron is
    // paused, undeployed, or mis-secreted.
    const graceExpired = status !== null && !isHealthyStatus(status) && !graceActive;
    const effectiveTier: EntitlementContext['tier'] = graceExpired ? 'free' : rawTier;

    const cogsTripped = effectiveTier === 'free' && entitlement?.cogsBreakerTrippedAt != null;
    const baseLimits = graceExpired ? {} : (entitlement?.limits ?? {});
    const limits = cogsTripped ? { ...baseLimits, maxAgentTasks: 0 } : baseLimits;

    c.set('entitlements', {
      userId,
      accountId: membership.accountId,
      membershipRole: membership.role,
      subscriptionStatus: status,
      graceUntil,
      tier: effectiveTier,
      features: graceExpired
        ? {}
        : entitlement?.features && Object.keys(entitlement.features).length > 0
          ? toFeatureRecord(entitlement.features)
          : toFeatureRecord(getFeaturesForTier(effectiveTier)),
      limits,
      resolvedAt: new Date(),
    } satisfies EntitlementContext);

    await next();
  };
};

export function getEntitlementsFromContext(c: {
  get: (key: string) => unknown;
}): EntitlementContext {
  return (c.get('entitlements') as EntitlementContext | undefined) ?? createFreeEntitlements(null);
}
