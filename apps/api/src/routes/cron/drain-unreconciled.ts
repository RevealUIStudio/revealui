/**
 * Cron: Drain Unreconciled Webhooks
 *
 * Replays Stripe webhook events that previously failed with a stale
 * idempotency marker. Without this drainer, the `unreconciledWebhooks`
 * queue is write-only — events land there, an alert email fires, and the
 * only reconciliation path is manual database intervention.
 *
 * Triggered by the consolidated `/api/cron/dispatch` (daily on Vercel
 * Hobby). Also exposed directly at `/api/cron/drain-unreconciled` so a
 * 15-minute external scheduler (GitHub Actions, Upstash Cron, etc.) can
 * drive it more aggressively without requiring a Vercel Pro plan.
 *
 * Protected by X-Cron-Secret header (timing-safe compare).
 *
 * Design notes:
 *
 *  - Batch size is bounded (`DRAIN_BATCH_SIZE`, default 10) so a single
 *    run never exceeds the Vercel 30s function budget regardless of how
 *    deep the queue grows. Remaining rows get picked up on the next tick.
 *  - The drainer fetches each event from Stripe (source of truth) rather
 *    than trusting our stored fields. A manual resolution in the Stripe
 *    dashboard is reflected on the next run.
 *  - Rows unresolved for >24h are logged at ERROR level with "CRITICAL"
 *    in the message. We deliberately do NOT auto-mark critical rows as
 *    resolved — human review is required. Silent auto-resolve would
 *    mask real billing bugs.
 *  - Stale idempotency markers are deleted before each replay. This is
 *    the whole reason the row is unreconciled; the handler would
 *    otherwise return early as duplicate.
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { unreconciledWebhooks } from '@revealui/db/schema';
import { protectedStripe } from '@revealui/services';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { replayStripeEvent } from '../../lib/webhook-replay.js';
import webhooksApp from '../webhooks.js';

const app = new Hono();

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_DURATION_BUDGET_MS = 20_000;
const CRITICAL_AGE_MS = 24 * 60 * 60 * 1000;

type Outcome =
  | 'replayed'
  | 'duplicate'
  | 'event-missing'
  | 'stripe-error'
  | 'handler-error'
  | 'timeout';

interface Result {
  eventId: string;
  eventType: string;
  outcome: Outcome;
  status?: number;
  detail?: string;
  ageMs: number;
  critical: boolean;
}

app.post('/drain-unreconciled', async (c) => {
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

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return c.json(
      {
        error:
          'Drainer disabled — STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET(_LIVE) must both be set.',
      },
      503,
    );
  }

  const batchSize = Number.parseInt(process.env.DRAIN_BATCH_SIZE ?? '', 10) || DEFAULT_BATCH_SIZE;
  const durationBudgetMs =
    Number.parseInt(process.env.DRAIN_DURATION_BUDGET_MS ?? '', 10) || DEFAULT_DURATION_BUDGET_MS;

  const db = getClient();
  // GAP-131: shared protectedStripe wrapper. The events.retrieve surface
  // is structurally compatible with replayStripeEvent's ReplayDeps.stripe
  // (StripeEventsClient).
  const stripe = protectedStripe;

  // Oldest unresolved first — they are most at risk of escalating past the
  // 24h critical threshold.
  const rows = await db
    .select({
      eventId: unreconciledWebhooks.eventId,
      eventType: unreconciledWebhooks.eventType,
      createdAt: unreconciledWebhooks.createdAt,
    })
    .from(unreconciledWebhooks)
    .where(isNull(unreconciledWebhooks.resolvedAt))
    .orderBy(asc(unreconciledWebhooks.createdAt))
    .limit(batchSize);

  if (rows.length === 0) {
    return c.json({ scanned: 0, replayed: 0, remaining: 0, results: [] }, 200);
  }

  const startedAt = Date.now();
  const results: Result[] = [];
  let replayed = 0;
  let criticalCount = 0;

  for (const row of rows) {
    const ageMs = Date.now() - row.createdAt.getTime();
    const critical = ageMs >= CRITICAL_AGE_MS;
    if (critical) criticalCount += 1;

    if (Date.now() - startedAt >= durationBudgetMs) {
      results.push({
        eventId: row.eventId,
        eventType: row.eventType,
        outcome: 'timeout',
        ageMs,
        critical,
      });
      continue;
    }

    const outcome = await replayStripeEvent(
      // webhooksApp is an OpenAPIHono; the replay helper only needs `.fetch`.
      {
        stripe,
        db,
        webhookSecret,
        webhooksApp: webhooksApp as { fetch: (r: Request) => Promise<Response> },
      },
      row.eventId,
    );

    if (outcome.kind === 'replayed') {
      await db
        .update(unreconciledWebhooks)
        .set({ resolvedAt: new Date(), resolvedBy: 'cron' })
        .where(
          and(
            eq(unreconciledWebhooks.eventId, row.eventId),
            isNull(unreconciledWebhooks.resolvedAt),
          ),
        );
      replayed += 1;
      results.push({
        eventId: row.eventId,
        eventType: row.eventType,
        outcome: outcome.duplicate ? 'duplicate' : 'replayed',
        status: outcome.status,
        ageMs,
        critical,
      });
      continue;
    }

    if (outcome.kind === 'event-missing') {
      // The event no longer exists in Stripe — probably test-mode data
      // deleted, or the event was never real. Mark resolved so we stop
      // retrying it, but tag with a distinct resolvedBy value so it's
      // searchable if we need to audit deletions later.
      await db
        .update(unreconciledWebhooks)
        .set({ resolvedAt: new Date(), resolvedBy: 'cron:event-missing' })
        .where(
          and(
            eq(unreconciledWebhooks.eventId, row.eventId),
            isNull(unreconciledWebhooks.resolvedAt),
          ),
        );
      results.push({
        eventId: row.eventId,
        eventType: row.eventType,
        outcome: 'event-missing',
        detail: outcome.detail,
        ageMs,
        critical,
      });
      continue;
    }

    // stripe-error or handler-error: leave unresolved, log, move on.
    const detail =
      outcome.kind === 'handler-error'
        ? `handler returned ${outcome.status}: ${JSON.stringify(outcome.body)}`
        : outcome.detail;

    if (critical) {
      logger.error(
        `[drain-unreconciled] CRITICAL: event ${row.eventId} unresolved >24h and replay failed`,
        undefined,
        { eventId: row.eventId, eventType: row.eventType, ageMs, detail },
      );
    } else {
      logger.warn(`[drain-unreconciled] replay failed for ${row.eventId}`, {
        eventType: row.eventType,
        ageMs,
        detail,
      });
    }

    results.push({
      eventId: row.eventId,
      eventType: row.eventType,
      outcome: outcome.kind === 'handler-error' ? 'handler-error' : 'stripe-error',
      ...(outcome.kind === 'handler-error' ? { status: outcome.status } : {}),
      detail,
      ageMs,
      critical,
    });
  }

  return c.json(
    {
      scanned: rows.length,
      replayed,
      critical: criticalCount,
      remaining: rows.length === batchSize ? 'possibly-more' : 0,
      durationMs: Date.now() - startedAt,
      results,
    },
    200,
  );
});

export default app;
