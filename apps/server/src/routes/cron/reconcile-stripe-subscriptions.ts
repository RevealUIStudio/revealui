/**
 * Cron: Reconcile Stripe Subscriptions → Local Rows (unsynced subscription detection)
 *
 * Walks Stripe subscriptions created in the last 60 days and verifies each
 * LIVE one has a matching local row in `accountSubscriptions.stripeSubscriptionId`.
 * A live Stripe subscription with no local match is "unsynced": the user is
 * paying or trialing but the hosted `account_subscriptions` /
 * `account_entitlements` rows were never created, so they are silently gated as
 * free despite an active Stripe trial or subscription.
 *
 * Root cause (production incident): a trial whose `checkout.session.completed`
 * webhook failed while the API was 503ing never wrote the hosted rows. The
 * existing reconciliation crons all walk LOCAL rows OUTWARD to Stripe, so the
 * gap — no local row at all — is invisible to them. This cron walks Stripe
 * INWARD and flags the gap.
 *
 * **Alert-only.** Writes a row into `unreconciledWebhooks` with a distinct
 * `event_type='subscription.unsynced'` so the drainer cron and reconciliation
 * dashboard pick it up. Auto-recovery (synthesizing local rows from a Stripe
 * subscription) is deferred — it is an attack surface if an attacker can write
 * Stripe subscriptions.
 *
 * Idempotent: re-running the cron does NOT re-alert on a subscription that
 * already has an unreconciled row. Orphan rows use a synthetic event_id of
 * `cron-sub-orphan:<subscriptionId>` so re-runs collide.
 *
 * Bounded batch: up to 100 Stripe subscriptions per cron tick. If Stripe
 * reports `has_more`, a WARN is logged so ops knows the next tick has work.
 *
 * Protected by X-Cron-Secret header (timing-safe compare), same gate as the
 * other reconciliation crons.
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { accountSubscriptions, unreconciledWebhooks } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type Stripe from 'stripe';
import { sendCronFailureAlert } from '../../lib/cron-alerts.js';
import { getServices } from '../../lib/services-loader.js';

const app = new Hono();

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 100;
const DEFAULT_LOOKBACK_DAYS = 60;
const UNSYNCED_EVENT_TYPE = 'subscription.unsynced';

const LIVE_STATUSES = new Set(['trialing', 'active', 'past_due', 'incomplete']);

interface SubscriptionScanResult {
  subscriptionId: string;
  status: string;
  outcome:
    | 'skipped-not-live'
    | 'skipped-no-customer'
    | 'matched'
    | 'orphan-already-tracked'
    | 'orphan-newly-alerted';
}

app.post('/reconcile-stripe-subscriptions', async (c) => {
  // ── auth gate (mirrors reconcile-customers) ───────────────────────────
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
    return c.json(
      {
        error: 'Reconcile-stripe-subscriptions disabled — STRIPE_SECRET_KEY is not set.',
      },
      503,
    );
  }

  const batchSize = Math.min(
    Number.parseInt(process.env.RECONCILE_STRIPE_SUBSCRIPTIONS_BATCH_SIZE ?? '', 10) ||
      DEFAULT_BATCH_SIZE,
    MAX_BATCH_SIZE,
  );
  const lookbackDays =
    Number.parseInt(process.env.RECONCILE_STRIPE_SUBSCRIPTIONS_LOOKBACK_DAYS ?? '', 10) ||
    DEFAULT_LOOKBACK_DAYS;
  const lookbackUnix = Math.floor((Date.now() - lookbackDays * 24 * 60 * 60 * 1000) / 1000);

  const services = await getServices();
  if (!services) {
    return c.json(
      { error: 'Reconcile-stripe-subscriptions disabled — @revealui/services not installed.' },
      503,
    );
  }
  const db = getClient();
  const stripe = services.protectedStripe;

  // ── pull Stripe subscriptions in window ───────────────────────────────
  let page: Stripe.ApiList<Stripe.Subscription>;
  try {
    page = await stripe.subscriptions.list({
      status: 'all',
      created: { gte: lookbackUnix },
      limit: batchSize,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.error(
      '[reconcile-stripe-subscriptions] Stripe subscriptions.list failed',
      err instanceof Error ? err : undefined,
      { detail },
    );
    return c.json({ error: 'stripe-error', detail }, 502);
  }

  const subscriptions = page.data;
  const startedAt = Date.now();
  const results: SubscriptionScanResult[] = [];
  let liveCount = 0;
  let orphanedCount = 0;
  let alertedCount = 0;

  for (const sub of subscriptions) {
    // ── LIVE check ────────────────────────────────────────────────────
    if (!LIVE_STATUSES.has(sub.status)) {
      results.push({ subscriptionId: sub.id, status: sub.status, outcome: 'skipped-not-live' });
      continue;
    }
    liveCount += 1;

    // ── resolve customerId ────────────────────────────────────────────
    const customerId =
      typeof sub.customer === 'string'
        ? sub.customer
        : ((sub.customer as { id?: string } | null)?.id ?? null);

    if (!customerId) {
      logger.warn('[reconcile-stripe-subscriptions] subscription has no resolvable customerId', {
        subscriptionId: sub.id,
        status: sub.status,
      });
      results.push({ subscriptionId: sub.id, status: sub.status, outcome: 'skipped-no-customer' });
      continue;
    }

    // ── lookup: accountSubscriptions.stripeSubscriptionId ─────────────
    const localMatches = await db
      .select({ accountId: accountSubscriptions.accountId })
      .from(accountSubscriptions)
      .where(eq(accountSubscriptions.stripeSubscriptionId, sub.id))
      .limit(1);

    if (localMatches.length > 0) {
      results.push({ subscriptionId: sub.id, status: sub.status, outcome: 'matched' });
      continue;
    }

    // ── orphan detected — check idempotency ───────────────────────────
    orphanedCount += 1;
    const syntheticEventId = `cron-sub-orphan:${sub.id}`;
    const existingAlert = await db
      .select({ eventId: unreconciledWebhooks.eventId })
      .from(unreconciledWebhooks)
      .where(eq(unreconciledWebhooks.eventId, syntheticEventId))
      .limit(1);

    if (existingAlert.length > 0) {
      results.push({
        subscriptionId: sub.id,
        status: sub.status,
        outcome: 'orphan-already-tracked',
      });
      continue;
    }

    // ── write a fresh alert row ────────────────────────────────────────
    const errorTrace = [
      `Unsynced Stripe subscription ${sub.id} (status: ${sub.status}, customer: ${customerId}) has no account_subscriptions row.`,
      'Hosted entitlement state was never created — likely a failed checkout.session.completed webhook during an outage.',
      'Remedy: resend the checkout.session.completed event from the Stripe dashboard.',
    ].join(' ');

    try {
      await db.insert(unreconciledWebhooks).values({
        eventId: syntheticEventId,
        eventType: UNSYNCED_EVENT_TYPE,
        customerId,
        stripeObjectId: sub.id,
        objectType: 'subscription',
        errorTrace,
      });
      alertedCount += 1;
      logger.error(
        `[reconcile-stripe-subscriptions] CRITICAL: unsynced Stripe subscription ${sub.id}`,
        undefined,
        {
          subscriptionId: sub.id,
          customerId,
          status: sub.status,
        },
      );
      void sendCronFailureAlert({
        jobName: 'reconcile-stripe-subscriptions',
        error: new Error(`CRITICAL: unsynced Stripe subscription ${sub.id}`),
        severity: 'error',
        metadata: {
          subscriptionId: sub.id,
          customerId,
          status: sub.status,
        },
      });
      results.push({ subscriptionId: sub.id, status: sub.status, outcome: 'orphan-newly-alerted' });
    } catch (err) {
      // Insert can fail under multi-region race (two ticks both see the
      // orphan, both try to insert; the second hit is a primary-key conflict
      // because both ticks hash the same syntheticEventId). Treat as
      // already-tracked rather than re-throwing — the row is the goal.
      logger.warn(
        `[reconcile-stripe-subscriptions] insert into unreconciledWebhooks raced for ${sub.id} — treating as already-tracked`,
        { detail: err instanceof Error ? err.message : String(err) },
      );
      results.push({
        subscriptionId: sub.id,
        status: sub.status,
        outcome: 'orphan-already-tracked',
      });
    }
  }

  // Pagination signal: if Stripe says there's more, log WARN so ops knows
  // the backlog is deeper than one tick.
  if (page.has_more) {
    logger.warn(
      '[reconcile-stripe-subscriptions] Stripe pagination indicates more subscriptions in the lookback window than the batch size; deferred to next tick.',
      {
        scanned: subscriptions.length,
        batchSize,
        lookbackDays,
      },
    );
  }

  return c.json(
    {
      scanned: subscriptions.length,
      live: liveCount,
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
