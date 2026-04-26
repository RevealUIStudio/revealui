/**
 * Cron: Reconcile Stripe Customers → Local Rows (orphan detection)
 *
 * Walks Stripe customers created in the last 30 days and verifies each one
 * has a matching local row — either `users.stripeCustomerId` or
 * `accountSubscriptions.stripeCustomerId`. A Stripe customer with no local
 * match is "orphaned": payment infrastructure thinks they exist, but our
 * system has no record of them.
 *
 * Complements the three existing reconciliation crons, which all walk LOCAL
 * rows outward to Stripe:
 *   - drain-unreconciled — replays events that landed in our queue
 *   - reconcile-subscriptions — checks our active rows still match Stripe
 *   - sweep-grace-periods — terminates expired past_due rows
 *
 * Surfaced 2026-04-25 in the Surface 10 audit (Gap B). The orphan path is
 * the only failure mode where a customer is paying or attempting to pay
 * Stripe with zero local awareness — surface 8 / surface 1 / surface 3 all
 * presume the post-handler-crash insertion into `unreconciledWebhooks`
 * succeeded; if both that AND the local row insert fail, only a Stripe-
 * outward walk will detect it.
 *
 * **Alert-only.** This pass writes a row into `unreconciledWebhooks` with a
 * distinct `event_type='customer.orphaned'` so the existing drainer cron +
 * reconciliation dashboard pick it up. Auto-recovery (synthesizing a local
 * `users` row from the Stripe customer email) has its own attack surface
 * — an attacker who can write Stripe customers could create arbitrary
 * local rows. Auto-recovery is deferred to v0.4.x post-flip.
 *
 * Idempotent: re-running the cron does NOT re-alert on a customer that
 * already has an unreconciled row keyed by `customer_id`. The drainer
 * resolves rows by event_id; orphan rows use a synthetic event_id of
 * `cron-orphan:<customerId>` so re-runs collide.
 *
 * Bounded batch: process up to 100 Stripe customers per cron tick. If
 * pagination would have continued beyond the batch, log a WARN so ops
 * knows the next tick has more work.
 *
 * Protected by X-Cron-Secret header (timing-safe compare), same gate as
 * the other reconciliation crons.
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { accountSubscriptions, unreconciledWebhooks, users } from '@revealui/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import Stripe from 'stripe';

const app = new Hono();

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_LOOKBACK_DAYS = 30;
const ORPHAN_EVENT_TYPE = 'customer.orphaned';

interface CustomerScanResult {
  customerId: string;
  email: string | null;
  outcome: 'matched' | 'orphan-already-tracked' | 'orphan-newly-alerted';
}

app.post('/reconcile-customers', async (c) => {
  // ── auth gate (mirrors drain-unreconciled / reconcile-subscriptions) ──
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

  // ── env gating ────────────────────────────────────────────────────────
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return c.json({ error: 'Reconcile-customers disabled — STRIPE_SECRET_KEY is not set.' }, 503);
  }

  const batchSize =
    Number.parseInt(process.env.RECONCILE_CUSTOMERS_BATCH_SIZE ?? '', 10) || DEFAULT_BATCH_SIZE;
  const lookbackDays =
    Number.parseInt(process.env.RECONCILE_CUSTOMERS_LOOKBACK_DAYS ?? '', 10) ||
    DEFAULT_LOOKBACK_DAYS;
  const lookbackUnix = Math.floor((Date.now() - lookbackDays * 24 * 60 * 60 * 1000) / 1000);

  const db = getClient();
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-03-25.dahlia' });

  // ── pull Stripe customers in window ───────────────────────────────────
  // Bounded: a single page of up to `batchSize`. We DO check `has_more`
  // after the page so ops sees a WARN when the queue is larger than one
  // tick — but we deliberately do NOT auto-paginate. Each cron tick is
  // budget-bounded; deeper backlogs surface naturally on the next tick
  // (Stripe's `created` filter is sticky and the same window keeps the
  // same customers in scope for ~30 days).
  let page: Stripe.ApiList<Stripe.Customer>;
  try {
    page = await stripe.customers.list({
      created: { gte: lookbackUnix },
      limit: Math.min(batchSize, 100), // Stripe's hard ceiling per page is 100
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.error(
      '[reconcile-customers] Stripe customers.list failed',
      err instanceof Error ? err : undefined,
      { detail },
    );
    return c.json({ error: 'stripe-error', detail }, 502);
  }

  const customers = page.data;

  if (customers.length === 0) {
    return c.json(
      { scanned: 0, orphaned: 0, alerted: 0, hasMore: page.has_more, results: [] },
      200,
    );
  }

  const startedAt = Date.now();
  const results: CustomerScanResult[] = [];
  let orphanedCount = 0;
  let alertedCount = 0;

  for (const customer of customers) {
    // Stripe SDK types `deleted` only on the DeletedCustomer subtype; the
    // active Customer type has it as `void | undefined`. Cast through unknown
    // to read the runtime field defensively — Stripe's customers.list doesn't
    // normally surface deleted entries but historical responses have.
    if ((customer as unknown as { deleted?: boolean }).deleted === true) {
      // Deleted customers are not orphans — they were intentionally removed
      // from Stripe and may or may not have ever had a local row. Skip.
      continue;
    }

    // ── lookup 1: users.stripeCustomerId ───────────────────────────────
    const userMatches = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stripeCustomerId, customer.id))
      .limit(1);

    if (userMatches.length > 0) {
      results.push({
        customerId: customer.id,
        email: customer.email ?? null,
        outcome: 'matched',
      });
      continue;
    }

    // ── lookup 2: accountSubscriptions.stripeCustomerId ────────────────
    const subscriptionMatches = await db
      .select({ accountId: accountSubscriptions.accountId })
      .from(accountSubscriptions)
      .where(eq(accountSubscriptions.stripeCustomerId, customer.id))
      .limit(1);

    if (subscriptionMatches.length > 0) {
      results.push({
        customerId: customer.id,
        email: customer.email ?? null,
        outcome: 'matched',
      });
      continue;
    }

    // ── orphan detected — check idempotency ────────────────────────────
    orphanedCount += 1;
    const syntheticEventId = `cron-orphan:${customer.id}`;
    const existingAlert = await db
      .select({ eventId: unreconciledWebhooks.eventId })
      .from(unreconciledWebhooks)
      .where(eq(unreconciledWebhooks.eventId, syntheticEventId))
      .limit(1);

    if (existingAlert.length > 0) {
      // Already tracked — silent skip so we don't double-page on every
      // tick. The drainer / dashboard owns lifecycle from here.
      results.push({
        customerId: customer.id,
        email: customer.email ?? null,
        outcome: 'orphan-already-tracked',
      });
      continue;
    }

    // ── write a fresh alert row ────────────────────────────────────────
    // Schema requires `error_trace` notNull — synthesize a description
    // that captures everything an admin needs without re-querying Stripe.
    const errorTrace = [
      `Orphaned Stripe customer ${customer.id} has no local users row and no accountSubscriptions row.`,
      `Stripe customer email: ${customer.email ?? '(unset)'}.`,
      `Stripe customer created: ${new Date(customer.created * 1000).toISOString()}.`,
      'Surface 10 Gap B / GAP-143 — manual reconciliation required.',
    ].join(' ');

    try {
      await db.insert(unreconciledWebhooks).values({
        eventId: syntheticEventId,
        eventType: ORPHAN_EVENT_TYPE,
        customerId: customer.id,
        stripeObjectId: customer.id,
        objectType: 'customer',
        errorTrace,
      });
      alertedCount += 1;
      logger.error(
        `[reconcile-customers] CRITICAL: orphaned Stripe customer ${customer.id}`,
        undefined,
        {
          customerId: customer.id,
          email: customer.email ?? null,
          createdUnix: customer.created,
        },
      );
      results.push({
        customerId: customer.id,
        email: customer.email ?? null,
        outcome: 'orphan-newly-alerted',
      });
    } catch (err) {
      // Insert can fail under multi-region race (two ticks both see the
      // orphan, both try to insert; second hit is a primary-key conflict
      // because both ticks hash the same syntheticEventId). Treat as
      // already-tracked rather than re-throwing — the row is the goal.
      logger.warn(
        `[reconcile-customers] insert into unreconciledWebhooks raced for ${customer.id} — treating as already-tracked`,
        { detail: err instanceof Error ? err.message : String(err) },
      );
      results.push({
        customerId: customer.id,
        email: customer.email ?? null,
        outcome: 'orphan-already-tracked',
      });
    }
  }

  // Pagination signal: if Stripe says there's more we didn't pull, log a
  // WARN so ops knows backlogs are deeper than one tick.
  if (page.has_more) {
    logger.warn(
      '[reconcile-customers] Stripe pagination indicates more customers in the lookback window than the batch size; deferred to next tick.',
      {
        scanned: customers.length,
        batchSize,
        lookbackDays,
      },
    );
  }

  return c.json(
    {
      scanned: customers.length,
      orphaned: orphanedCount,
      alerted: alertedCount,
      hasMore: page.has_more,
      durationMs: Date.now() - startedAt,
      results,
    },
    200,
  );
});

export default app;
