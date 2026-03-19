import type { Database } from '@revealui/db/client';
import { accountEntitlements, accountSubscriptions, licenses } from '@revealui/db/schema';
import { desc, eq } from 'drizzle-orm';

/**
 * Query billing status with grace period enforcement.
 *
 * When a subscription is past_due/canceled/revoked but graceUntil is in the future,
 * returns 'grace_period' — the customer retains access until grace expires.
 */
export async function queryBillingStatusByCustomerId(
  db: Database,
  customerId: string,
): Promise<string | null> {
  const [license] = await db
    .select({ status: licenses.status, expiresAt: licenses.expiresAt })
    .from(licenses)
    .where(eq(licenses.customerId, customerId))
    .orderBy(desc(licenses.createdAt))
    .limit(1);

  if (license?.status) {
    // Grace period for legacy licenses: if expired but expiresAt is in the future, allow access
    if (
      (license.status === 'expired' || license.status === 'revoked') &&
      license.expiresAt &&
      license.expiresAt > new Date()
    ) {
      return 'grace_period';
    }
    return license.status;
  }

  const [accountSubscription] = await db
    .select({ accountId: accountSubscriptions.accountId })
    .from(accountSubscriptions)
    .where(eq(accountSubscriptions.stripeCustomerId, customerId))
    .limit(1);

  if (!accountSubscription?.accountId) {
    return null;
  }

  const [entitlement] = await db
    .select({
      status: accountEntitlements.status,
      graceUntil: accountEntitlements.graceUntil,
    })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.accountId, accountSubscription.accountId))
    .limit(1);

  if (!entitlement?.status) return null;

  // Grace period enforcement: if status is degraded but graceUntil is in the future,
  // the customer retains access until grace expires
  const now = new Date();
  if (
    (entitlement.status === 'past_due' ||
      entitlement.status === 'canceled' ||
      entitlement.status === 'revoked') &&
    entitlement.graceUntil &&
    entitlement.graceUntil > now
  ) {
    return 'grace_period';
  }

  return entitlement.status;
}
