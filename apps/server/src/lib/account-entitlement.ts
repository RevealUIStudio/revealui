/**
 * Account-scoped AI entitlement lookup (GAP-360 §5.6).
 *
 * The non-Hono counterpart to `entitlementMiddleware`: resolves whether a given
 * user's account has the `ai` feature, via the GAP-356 canonical path
 * (`account_entitlements` scoped by `getConfiguredStripeMode()`), applying the
 * same request-time grace-expiry fail-safe. Used by the durable worker, which
 * has no request context but must gate per-account rather than on the singleton
 * license state.
 */

import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import { getFeaturesForTier } from '@revealui/core/features';
import type { Database } from '@revealui/db/client';
import { accountEntitlements, accountMemberships } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';

/** A subscription status that still confers the paid tier (mirrors the middleware). */
function isHealthyStatus(status: string | null): boolean {
  return status === 'active' || status === 'trialing';
}

function featureRecord(features: object | null | undefined): Record<string, boolean> {
  if (!features) return {};
  return Object.fromEntries(
    Object.entries(features).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
    ),
  );
}

/**
 * Whether the account owning `userId` currently has the `ai` feature.
 *
 * Fail-closed: a null user, no active membership, no entitlement row, or a
 * grace-expired subscription all resolve to `false`. `userId` MUST come from an
 * authenticated identity (the task's owning account for the worker), never a
 * request payload (§6.1).
 */
export async function accountHasAiFeature(db: Database, userId: string | null): Promise<boolean> {
  if (!userId) return false;

  const [membership] = await db
    .select({ accountId: accountMemberships.accountId })
    .from(accountMemberships)
    .where(and(eq(accountMemberships.userId, userId), eq(accountMemberships.status, 'active')))
    .limit(1);

  if (!membership?.accountId) return false;

  const [entitlement] = await db
    .select({
      tier: accountEntitlements.tier,
      status: accountEntitlements.status,
      graceUntil: accountEntitlements.graceUntil,
      features: accountEntitlements.features,
    })
    .from(accountEntitlements)
    .where(
      and(
        eq(accountEntitlements.accountId, membership.accountId),
        eq(accountEntitlements.mode, getConfiguredStripeMode()),
      ),
    )
    .limit(1);

  if (!entitlement) return false;

  const status = entitlement.status ?? null;
  const graceUntil = entitlement.graceUntil ?? null;
  const graceActive = graceUntil != null && graceUntil.getTime() > Date.now();
  const graceExpired = status !== null && !isHealthyStatus(status) && !graceActive;
  if (graceExpired) return false;

  const tier = (entitlement.tier as 'free' | 'pro' | 'max' | 'enterprise' | undefined) ?? 'free';
  const features =
    entitlement.features && Object.keys(entitlement.features).length > 0
      ? featureRecord(entitlement.features)
      : featureRecord(getFeaturesForTier(tier));

  return features.ai === true;
}
