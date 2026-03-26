/**
 * Cron: Sweep Expired Grace Periods
 *
 * Finds entitlements where graceUntil has passed and status is still 'past_due',
 * then transitions them to 'expired' so the billing-status check blocks access.
 * Also expires the corresponding legacy license row for consistency.
 *
 * Protected by X-Cron-Secret header.
 *
 * Schedule: every 15 minutes (configured in vercel.json)
 */

import { timingSafeEqual } from 'node:crypto';
import { resetLicenseState } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import { accountEntitlements, accountSubscriptions, licenses } from '@revealui/db/schema';
import { and, eq, lte } from 'drizzle-orm';
import { Hono } from 'hono';

const app = new Hono();

app.post('/sweep-grace-periods', async (c) => {
  const cronSecret = process.env.REVEALUI_CRON_SECRET;
  const provided = c.req.header('X-Cron-Secret') || c.req.header('x-cron-secret');

  if (!(cronSecret && provided)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(cronSecret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const db = getClient();
    const now = new Date();

    // Find entitlements with expired grace periods that are still in 'past_due' status
    const expiredGrace = await db
      .select({
        accountId: accountEntitlements.accountId,
        graceUntil: accountEntitlements.graceUntil,
      })
      .from(accountEntitlements)
      .where(
        and(eq(accountEntitlements.status, 'past_due'), lte(accountEntitlements.graceUntil, now)),
      );

    if (expiredGrace.length === 0) {
      return c.json({ expired: 0, accountIds: [] }, 200);
    }

    const expiredAccountIds: string[] = [];
    for (const entitlement of expiredGrace) {
      // Transition entitlement to 'expired' (billing-status will block access)
      await db
        .update(accountEntitlements)
        .set({ status: 'expired', graceUntil: null, updatedAt: now })
        .where(eq(accountEntitlements.accountId, entitlement.accountId));

      // Also expire the matching subscription row
      await db
        .update(accountSubscriptions)
        .set({ status: 'expired', updatedAt: now })
        .where(eq(accountSubscriptions.accountId, entitlement.accountId));

      // Find and expire the corresponding legacy license (by customer ID from subscription)
      const [sub] = await db
        .select({ stripeCustomerId: accountSubscriptions.stripeCustomerId })
        .from(accountSubscriptions)
        .where(eq(accountSubscriptions.accountId, entitlement.accountId))
        .limit(1);

      if (sub?.stripeCustomerId) {
        await db
          .update(licenses)
          .set({ status: 'expired', updatedAt: now })
          .where(eq(licenses.customerId, sub.stripeCustomerId));
      }

      expiredAccountIds.push(entitlement.accountId);
    }

    // Clear in-memory license cache so next request re-evaluates
    resetLicenseState();

    logger.info('Grace period sweep completed', {
      expired: expiredAccountIds.length,
      accountIds: expiredAccountIds,
    });

    return c.json({ expired: expiredAccountIds.length, accountIds: expiredAccountIds }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Grace period sweep failed', undefined, { error: message });
    return c.json({ error: message }, 500);
  }
});

export default app;
