/**
 * Request-scoped account entitlements middleware.
 *
 * This is an additive bridge toward account-level hosted entitlements.
 * It does not replace legacy license gates yet. It attaches the best-known
 * account, membership, and entitlement context to the request.
 */

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
    tier: 'free',
    features: {},
    limits: {},
    resolvedAt: new Date(),
  };
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
        features: accountEntitlements.features,
        limits: accountEntitlements.limits,
      })
      .from(accountEntitlements)
      .where(eq(accountEntitlements.accountId, membership.accountId))
      .limit(1);

    c.set('entitlements', {
      userId,
      accountId: membership.accountId,
      membershipRole: membership.role,
      subscriptionStatus: entitlement?.status ?? null,
      tier: (entitlement?.tier as EntitlementContext['tier'] | undefined) ?? 'free',
      features:
        entitlement?.features && Object.keys(entitlement.features).length > 0
          ? toFeatureRecord(entitlement.features)
          : toFeatureRecord(
              getFeaturesForTier(
                ((entitlement?.tier as EntitlementContext['tier'] | undefined) ?? 'free') as
                  | 'free'
                  | 'pro'
                  | 'max'
                  | 'enterprise',
              ),
            ),
      limits: entitlement?.limits ?? {},
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
