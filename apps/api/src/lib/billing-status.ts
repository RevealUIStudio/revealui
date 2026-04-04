import type { Database } from '@revealui/db/client';
import { accountEntitlements, accountSubscriptions, licenses } from '@revealui/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

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
    // Prefer active/support_expired licenses over expired/revoked — a customer may have
    // both a perpetual (active or support_expired) and a subscription (revoked) license.
    .orderBy(
      sql`CASE WHEN ${licenses.status} = 'active' THEN 0 WHEN ${licenses.status} = 'support_expired' THEN 0 ELSE 1 END`,
      desc(licenses.createdAt),
    )
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

/** Result of a support expiry query for perpetual licenses */
export interface SupportExpiryInfo {
  /** When the support contract expires (null if not a perpetual license) */
  supportExpiresAt: Date | null;
  /** Whether this is a perpetual license */
  perpetual: boolean;
}

/**
 * Query the support expiry date for a perpetual license by customer ID.
 *
 * Returns the supportExpiresAt from the most recent perpetual license for
 * the given customer. Matches both 'active' and 'support_expired' statuses
 * (the sweep cron may have already marked it). Non-perpetual licenses or
 * revoked/expired licenses return { perpetual: false }.
 */
export async function querySupportExpiry(
  db: Database,
  customerId: string,
): Promise<SupportExpiryInfo> {
  const [license] = await db
    .select({
      perpetual: licenses.perpetual,
      supportExpiresAt: licenses.supportExpiresAt,
      status: licenses.status,
    })
    .from(licenses)
    .where(and(eq(licenses.customerId, customerId), eq(licenses.perpetual, true)))
    // Prefer active over support_expired; skip revoked/expired entirely
    .orderBy(
      sql`CASE WHEN ${licenses.status} = 'active' THEN 0 WHEN ${licenses.status} = 'support_expired' THEN 1 ELSE 2 END`,
      desc(licenses.createdAt),
    )
    .limit(1);

  if (!license || (license.status !== 'active' && license.status !== 'support_expired')) {
    return { supportExpiresAt: null, perpetual: false };
  }

  return {
    supportExpiresAt: license.supportExpiresAt,
    perpetual: true,
  };
}
