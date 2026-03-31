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
      await db.transaction(async (tx) => {
        // Re-check status inside the transaction to prevent TOCTOU race:
        // a webhook may have already renewed this subscription between the
        // outer SELECT and this UPDATE. The WHERE clause ensures we only
        // expire entitlements still in 'past_due' state.
        const updated = await tx
          .update(accountEntitlements)
          .set({ status: 'expired', graceUntil: null, updatedAt: now })
          .where(
            and(
              eq(accountEntitlements.accountId, entitlement.accountId),
              eq(accountEntitlements.status, 'past_due'),
            ),
          );

        if (!updated.rowCount) return; // Status already changed — skip this account

        await tx
          .update(accountSubscriptions)
          .set({ status: 'expired', updatedAt: now })
          .where(eq(accountSubscriptions.accountId, entitlement.accountId));

        const [sub] = await tx
          .select({ stripeCustomerId: accountSubscriptions.stripeCustomerId })
          .from(accountSubscriptions)
          .where(eq(accountSubscriptions.accountId, entitlement.accountId))
          .limit(1);

        if (sub?.stripeCustomerId) {
          await tx
            .update(licenses)
            .set({ status: 'expired', updatedAt: now })
            .where(eq(licenses.customerId, sub.stripeCustomerId));
        }

        expiredAccountIds.push(entitlement.accountId);
      });
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
    return c.json({ error: 'Internal error during grace period sweep' }, 500);
  }
});

export default app;
