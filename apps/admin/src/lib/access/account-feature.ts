/**
 * Account-scoped feature entitlement lookup for admin routes (GAP-476).
 *
 * Mirrors apps/server/src/lib/account-entitlement.ts accountHasAiFeature:
 * membership → account_entitlements (stripe mode) → grace-expired fail-closed →
 * features from row or getFeaturesForTier(tier).
 *
 * Do not import from apps/server; keep this admin-local mirror in sync with
 * the server helper when entitlement rules change.
 */

import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import { type FeatureFlags, getFeaturesForTier } from '@revealui/core/features';
import type { Database } from '@revealui/db/client';
import { accountEntitlements, accountMemberships } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';

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
 * Whether the account owning `userId` currently has `featureKey`.
 *
 * Fail-closed: null userId, no active membership, no entitlement row, or a
 * grace-expired subscription all resolve to false.
 */
export async function accountHasFeature(
  db: Database,
  userId: string | null | undefined,
  featureKey: keyof FeatureFlags,
): Promise<boolean> {
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

  return features[featureKey] === true;
}
