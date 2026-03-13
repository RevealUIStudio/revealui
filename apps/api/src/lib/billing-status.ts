import type { Database } from '@revealui/db/client';
import { accountEntitlements, accountSubscriptions, licenses } from '@revealui/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function queryBillingStatusByCustomerId(
  db: Database,
  customerId: string,
): Promise<string | null> {
  const [license] = await db
    .select({ status: licenses.status })
    .from(licenses)
    .where(eq(licenses.customerId, customerId))
    .orderBy(desc(licenses.createdAt))
    .limit(1);

  if (license?.status) {
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
    .select({ status: accountEntitlements.status })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.accountId, accountSubscription.accountId))
    .limit(1);

  return entitlement?.status ?? null;
}
