/**
 * Cron: Revmarket publisher Connect payout.
 *
 * The owner bridges USDC to fiat and deposits USD in the platform Stripe
 * balance. This job does not trade. It reads that USD balance once per sweep,
 * then transfers to each publisher's marketplace_agents.stripeAccountId.
 *
 * Vercel Hobby allows one daily cron. This job is a dispatcher entry and
 * no-ops except Monday UTC, unless REVMARKET_PAYOUT_FORCE=1.
 *
 * Pays when unpaid accrued 80% is at least $25 and payableAt has passed
 * (completion + 7 days). A failed transfer marks the payout failed and sets
 * those earnings back to accrued. The earning amount is never updated.
 */

import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { marketplaceAgents, publisherEarnings, publisherPayouts } from '@revealui/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { sendCronFailureAlert } from '../../lib/cron-alerts.js';
import { revealuiCronSecretMatches } from '../../lib/cron-auth.js';
import { getServices } from '../../lib/services-loader.js';
import {
  type EarningStatus,
  executeWeeklySweep,
  type PlannedPayout,
  type SweepEarning,
} from '../../services/revmarket-payout-policy.js';

const app = new Hono();

const EARNING_STATUSES: readonly EarningStatus[] = [
  'accrued',
  'held_for_dispute',
  'released_to_payout',
  'paid',
  'dropped',
];

class RevmarketPayoutUnavailable extends Error {
  constructor() {
    super('Revmarket payouts disabled — @revealui/services not installed.');
    this.name = 'RevmarketPayoutUnavailable';
  }
}

function asEarningStatus(value: string): EarningStatus {
  for (const status of EARNING_STATUSES) {
    if (status === value) return status;
  }
  return 'dropped';
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  );
}

async function loadEligible(): Promise<SweepEarning[]> {
  const db = getClient();
  const rows = await db
    .select({
      id: publisherEarnings.id,
      publisherId: publisherEarnings.publisherId,
      amountUsdCents: publisherEarnings.amountUsdCents,
      status: publisherEarnings.status,
      payableAt: publisherEarnings.payableAt,
      stripeAccountId: marketplaceAgents.stripeAccountId,
    })
    .from(publisherEarnings)
    .leftJoin(marketplaceAgents, eq(publisherEarnings.agentId, marketplaceAgents.id))
    .where(eq(publisherEarnings.status, 'accrued'));

  return rows.map((row) => ({
    id: row.id,
    publisherId: row.publisherId,
    amountUsdCents: row.amountUsdCents,
    status: asEarningStatus(row.status),
    payableAt: row.payableAt,
    stripeAccountId: row.stripeAccountId,
  }));
}

async function readBridgedUsdCents(): Promise<number> {
  const services = await getServices();
  if (!services) throw new RevmarketPayoutUnavailable();
  const balance = await services.protectedStripe.balance.retrieve();
  const usd = balance.available.find((row) => row.currency === 'usd');
  return usd?.amount ?? 0;
}

async function transfer(
  payout: PlannedPayout,
  idempotencyKey: string,
): Promise<{ transferId: string }> {
  const services = await getServices();
  if (!services) throw new RevmarketPayoutUnavailable();
  const created = await services.protectedStripe.transfers.create(
    {
      amount: payout.amountUsdCents,
      currency: 'usd',
      destination: payout.stripeAccountId,
      metadata: {
        publisher_id: payout.publisherId,
        earning_count: String(payout.earningIds.length),
      },
    },
    { idempotencyKey },
  );
  return { transferId: created.id };
}

async function markPaid(
  payout: PlannedPayout & { transferId: string; weekStart: string },
): Promise<void> {
  const db = getClient();
  const payoutId = crypto.randomUUID();
  try {
    await db.insert(publisherPayouts).values({
      id: payoutId,
      publisherId: payout.publisherId,
      weekStart: payout.weekStart,
      stripeTransferId: payout.transferId,
      amountUsdCents: payout.amountUsdCents,
      status: 'paid',
      earningIds: [...payout.earningIds],
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }

  const [existing] = await db
    .select({ id: publisherPayouts.id })
    .from(publisherPayouts)
    .where(
      and(
        eq(publisherPayouts.publisherId, payout.publisherId),
        eq(publisherPayouts.weekStart, payout.weekStart),
        eq(publisherPayouts.status, 'paid'),
      ),
    )
    .limit(1);

  await db
    .update(publisherEarnings)
    .set({ status: 'paid', payoutId: existing?.id ?? payoutId })
    .where(inArray(publisherEarnings.id, [...payout.earningIds]));
}

async function markFailed(
  payout: PlannedPayout & { weekStart: string; error: string },
): Promise<void> {
  const db = getClient();
  await db.insert(publisherPayouts).values({
    id: crypto.randomUUID(),
    publisherId: payout.publisherId,
    weekStart: payout.weekStart,
    stripeTransferId: null,
    amountUsdCents: payout.amountUsdCents,
    status: 'failed',
    earningIds: [...payout.earningIds],
    failedAt: new Date(),
  });
  await db
    .update(publisherEarnings)
    .set({ status: 'accrued', payoutId: null })
    .where(inArray(publisherEarnings.id, [...payout.earningIds]));

  logger.error('Revmarket payout transfer failed', undefined, {
    publisherId: payout.publisherId,
    amountUsdCents: payout.amountUsdCents,
    error: payout.error,
  });
}

app.post('/revmarket-payouts', async (c) => {
  const provided = c.req.header('X-Cron-Secret') || c.req.header('x-cron-secret');
  if (!revealuiCronSecretMatches(provided)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const result = await executeWeeklySweep({
      now: new Date(),
      force: process.env.REVMARKET_PAYOUT_FORCE === '1',
      loadEligible,
      readBridgedUsdCents,
      transfer,
      markPaid,
      markFailed,
    });

    for (const failure of result.failed) {
      void sendCronFailureAlert({
        jobName: 'revmarket-payouts',
        error: new Error(failure.error),
        severity: 'error',
        metadata: { publisherId: failure.publisherId },
      });
    }

    logger.info('Revmarket payout cron completed', {
      reason: result.reason,
      paid: result.paid.length,
      failed: result.failed.length,
      conversionCalls: result.conversionCalls,
    });

    return c.json(
      {
        status: result.failed.length > 0 ? 'partial' : 'ok',
        ...result,
        processedAt: new Date().toISOString(),
      },
      200,
    );
  } catch (err) {
    if (err instanceof RevmarketPayoutUnavailable) {
      return c.json({ error: err.message }, 503);
    }
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Revmarket payout cron failed', err instanceof Error ? err : undefined);
    void sendCronFailureAlert({
      jobName: 'revmarket-payouts',
      error: err instanceof Error ? err : new Error(message),
      severity: 'error',
    });
    return c.json({ error: 'Revmarket payout sweep failed' }, 500);
  }
});

export default app;
