/**
 * Account-scoped feature entitlement lookup for admin routes (GAP-477).
 *
 * Mirrors apps/server/src/lib/account-entitlement.ts:
 * resolve membership (preferred + deterministic oldest) → account_entitlements
 * (stripe mode) → grace-expired fail-closed → features from row or tier map.
 *
 * Do not import from apps/server; keep this admin-local mirror in sync.
 */

import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import { type FeatureFlags, getFeaturesForTier } from '@revealui/core/features';
import type { Database } from '@revealui/db/client';
import { accountEntitlements } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';
import { resolveActiveMembership } from './resolve-membership';

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
 * @param preferredAccountId - Optional account id/slug (X-Tenant-ID / workspace).
 */
export async function accountHasFeature(
  db: Database,
  userId: string | null | undefined,
  featureKey: keyof FeatureFlags,
  preferredAccountId?: string | null,
): Promise<boolean> {
  if (!userId) return false;

  const membership = await resolveActiveMembership(db, userId, preferredAccountId);
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
