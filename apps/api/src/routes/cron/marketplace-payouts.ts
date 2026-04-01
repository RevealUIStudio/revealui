/**
 * Cron: MCP Marketplace Batch Payout
 *
 * Processes pending marketplace payouts to MCP server publishers
 * via Stripe Connect transfers.
 *
 * Logic:
 * 1. Find completed transactions without a stripeTransferId
 * 2. Group by developer (via server's stripeAccountId)
 * 3. Sum developer earnings per account
 * 4. Create Stripe transfer if total >= $0.50 (Stripe minimum)
 * 5. Mark transactions with the transfer ID
 *
 * Protected by X-Cron-Secret header.
 * Schedule: daily at 04:00 UTC (configured in vercel.json)
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import { marketplaceServers, marketplaceTransactions } from '@revealui/db/schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import Stripe from 'stripe';

const app = new Hono();

/** Stripe minimum transfer amount in cents */
const MIN_TRANSFER_CENTS = 50;

let cachedStripe: Stripe | undefined;
function getStripeClient(): Stripe {
  if (cachedStripe) return cachedStripe;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  cachedStripe = new Stripe(key);
  return cachedStripe;
}

interface PayoutResult {
  stripeAccountId: string;
  developerCents: number;
  transactionCount: number;
  transferId: string | null;
  error: string | null;
}

app.post('/marketplace-payouts', async (c) => {
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

    // Find completed transactions that haven't been paid out yet,
    // grouped by the server's Stripe Connect account
    const pendingPayouts = await db
      .select({
        stripeAccountId: marketplaceServers.stripeAccountId,
        totalDeveloperUsdc: sql<string>`SUM(CAST(${marketplaceTransactions.developerAmountUsdc} AS NUMERIC))`,
        transactionCount: sql<number>`COUNT(*)::int`,
        transactionIds: sql<string[]>`ARRAY_AGG(${marketplaceTransactions.id})`,
      })
      .from(marketplaceTransactions)
      .innerJoin(marketplaceServers, eq(marketplaceTransactions.serverId, marketplaceServers.id))
      .where(
        and(
          eq(marketplaceTransactions.status, 'completed'),
          isNull(marketplaceTransactions.stripeTransferId),
          sql`${marketplaceServers.stripeAccountId} IS NOT NULL`,
        ),
      )
      .groupBy(marketplaceServers.stripeAccountId);

    if (pendingPayouts.length === 0) {
      logger.info('Marketplace payout cron: no pending payouts');
      return c.json(
        {
          status: 'ok',
          processed: 0,
          payouts: [],
          processedAt: new Date().toISOString(),
        },
        200,
      );
    }

    const stripe = getStripeClient();
    const results: PayoutResult[] = [];

    for (const payout of pendingPayouts) {
      const stripeAccountId = payout.stripeAccountId;
      if (!stripeAccountId) continue;

      const totalUsdc = Number.parseFloat(payout.totalDeveloperUsdc);
      const developerCents = Math.round(totalUsdc * 100);

      if (developerCents < MIN_TRANSFER_CENTS) {
        logger.info('Marketplace payout below minimum', {
          stripeAccountId,
          developerCents,
          minCents: MIN_TRANSFER_CENTS,
          transactionCount: payout.transactionCount,
        });
        results.push({
          stripeAccountId,
          developerCents,
          transactionCount: payout.transactionCount,
          transferId: null,
          error: `Below minimum ($${(developerCents / 100).toFixed(2)} < $0.50)`,
        });
        continue;
      }

      try {
        const transfer = await stripe.transfers.create({
          amount: developerCents,
          currency: 'usd',
          destination: stripeAccountId,
          metadata: {
            batch_payout: 'true',
            transaction_count: String(payout.transactionCount),
            total_usdc: payout.totalDeveloperUsdc,
          },
        });

        // Mark all transactions in this batch with the transfer ID
        await db
          .update(marketplaceTransactions)
          .set({ stripeTransferId: transfer.id })
          .where(inArray(marketplaceTransactions.id, payout.transactionIds));

        results.push({
          stripeAccountId,
          developerCents,
          transactionCount: payout.transactionCount,
          transferId: transfer.id,
          error: null,
        });

        logger.info('Marketplace payout completed', {
          stripeAccountId,
          transferId: transfer.id,
          developerCents,
          transactionCount: payout.transactionCount,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Marketplace payout transfer failed', undefined, {
          stripeAccountId,
          developerCents,
          error: message,
        });
        results.push({
          stripeAccountId,
          developerCents,
          transactionCount: payout.transactionCount,
          transferId: null,
          error: message,
        });
      }
    }

    const succeeded = results.filter((r) => r.transferId !== null);
    const failed = results.filter((r) => r.error !== null && r.transferId === null);

    logger.info('Marketplace payout cron completed', {
      total: results.length,
      succeeded: succeeded.length,
      failed: failed.length,
    });

    return c.json(
      {
        status: failed.length > 0 ? 'partial' : 'ok',
        processed: results.length,
        succeeded: succeeded.length,
        failed: failed.length,
        payouts: results.map((r) => ({
          stripeAccountId: r.stripeAccountId,
          amountCents: r.developerCents,
          transactions: r.transactionCount,
          transferId: r.transferId,
          error: r.error,
        })),
        processedAt: new Date().toISOString(),
      },
      200,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Marketplace payout cron failed', undefined, { error: message });
    return c.json({ error: 'Internal error during marketplace payout processing' }, 500);
  }
});

export default app;
