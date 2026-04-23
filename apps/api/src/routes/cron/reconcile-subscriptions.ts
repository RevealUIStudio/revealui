/**
 * Cron: Reconcile Local Subscriptions ↔ Stripe
 *
 * For every local `accountSubscriptions` row with a status that implies an
 * active billing relationship (`active`, `trialing`, `past_due`), fetch the
 * canonical subscription from Stripe and compare. Drift gets logged at WARN
 * level; drift that materially changes entitlements gets logged at ERROR
 * with "CRITICAL" in the message.
 *
 * Complements the unreconciled-webhooks drainer (P1-F):
 *   - Drainer catches events where *our* handler failed and Stripe retried
 *     itself into stale idempotency.
 *   - This reconciler catches drift where *Stripe's* webhooks never reached
 *     us (network drop past the retry window, account-level webhook outage,
 *     manual Stripe-dashboard mutation, etc.).
 *
 * No auto-healing in this first pass. Alert only. Manual review decides
 * whether to replay events or hand-correct. Once we've observed drift
 * patterns for a few cycles, healing policy can be added with confidence.
 *
 * Protected by X-Cron-Secret header (timing-safe compare).
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { accountSubscriptions } from '@revealui/db/schema';
import { and, inArray, isNotNull } from 'drizzle-orm';
import { Hono } from 'hono';
import Stripe from 'stripe';

const app = new Hono();

/**
 * Local statuses that claim the customer has an active or recoverable
 * billing relationship. If Stripe disagrees on any of these, that's drift
 * that affects entitlements and customer trust.
 */
const LIVE_LOCAL_STATUSES = ['active', 'trialing', 'past_due'] as const;

/**
 * Map Stripe subscription status to the local status. Returns null for
 * statuses we don't track (e.g. `incomplete`) — treated as drift when
 * found against a LIVE local row.
 */
function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status,
): 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'paused' | null {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'canceled':
    case 'unpaid':
    case 'paused':
      return stripeStatus;
    case 'incomplete':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return null;
  }
}

/** Clamp number of subscriptions scanned per run so the function stays under Vercel budget. */
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_DURATION_BUDGET_MS = 25_000;

type Drift =
  | 'status-mismatch'
  | 'period-end-mismatch'
  | 'cancel-flag-mismatch'
  | 'missing-in-stripe'
  | 'stripe-error';

interface DriftReport {
  accountId: string;
  stripeSubscriptionId: string;
  drift: Drift;
  local: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  stripe?: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  critical: boolean;
  detail?: string;
}

app.post('/reconcile-subscriptions', async (c) => {
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
  if (!stripeSecretKey) {
    return c.json({ error: 'Reconciler disabled — STRIPE_SECRET_KEY is not set.' }, 503);
  }

  const batchSize =
    Number.parseInt(process.env.RECONCILE_BATCH_SIZE ?? '', 10) || DEFAULT_BATCH_SIZE;
  const durationBudgetMs =
    Number.parseInt(process.env.RECONCILE_DURATION_BUDGET_MS ?? '', 10) ||
    DEFAULT_DURATION_BUDGET_MS;

  const db = getClient();
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-03-25.dahlia' });

  // Only reconcile rows that believe they are live AND have a Stripe sub id
  // to compare against. Perpetual-license rows and credit-bundle-only
  // accounts have `stripeSubscriptionId = null` and are not in scope here.
  const rows = await db
    .select({
      accountId: accountSubscriptions.accountId,
      stripeSubscriptionId: accountSubscriptions.stripeSubscriptionId,
      status: accountSubscriptions.status,
      currentPeriodEnd: accountSubscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: accountSubscriptions.cancelAtPeriodEnd,
    })
    .from(accountSubscriptions)
    .where(
      and(
        isNotNull(accountSubscriptions.stripeSubscriptionId),
        // Focused on the statuses that imply access. Terminal rows
        // (canceled, expired, revoked) are not reconciled — if they come
        // back to life in Stripe, that's a webhook-delivery bug which the
        // drainer covers.
        inArray(accountSubscriptions.status, [...LIVE_LOCAL_STATUSES]),
      ),
    )
    .limit(batchSize);

  if (rows.length === 0) {
    return c.json({ scanned: 0, drift: 0, critical: 0, results: [] }, 200);
  }

  const startedAt = Date.now();
  const drifts: DriftReport[] = [];
  let criticalCount = 0;

  for (const row of rows) {
    if (Date.now() - startedAt >= durationBudgetMs) {
      logger.warn('[reconcile-subscriptions] duration budget reached; remaining rows deferred', {
        scanned: rows.length,
        processed: drifts.length,
      });
      break;
    }

    if (!row.stripeSubscriptionId) continue; // Type-guard; query already filters.

    let stripeSub: Stripe.Subscription;
    try {
      stripeSub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
    } catch (err) {
      const status =
        typeof (err as { statusCode?: unknown }).statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : undefined;
      const detail = err instanceof Error ? err.message : String(err);

      if (status === 404) {
        // Stripe doesn't have this subscription anymore but our DB still
        // thinks the customer is paying. Canonical "customer without
        // service" bug — always critical.
        const report: DriftReport = {
          accountId: row.accountId,
          stripeSubscriptionId: row.stripeSubscriptionId,
          drift: 'missing-in-stripe',
          local: {
            status: row.status,
            currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.toISOString() : null,
            cancelAtPeriodEnd: row.cancelAtPeriodEnd,
          },
          critical: true,
          detail: 'Stripe returned 404 for a subscription our DB marks active/trialing/past_due',
        };
        criticalCount += 1;
        drifts.push(report);
        logger.error(
          `[reconcile-subscriptions] CRITICAL: missing-in-stripe for account ${row.accountId}`,
          undefined,
          { ...report },
        );
        continue;
      }

      const report: DriftReport = {
        accountId: row.accountId,
        stripeSubscriptionId: row.stripeSubscriptionId,
        drift: 'stripe-error',
        local: {
          status: row.status,
          currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.toISOString() : null,
          cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        },
        critical: false,
        detail,
      };
      drifts.push(report);
      logger.warn(`[reconcile-subscriptions] Stripe error retrieving ${row.stripeSubscriptionId}`, {
        accountId: row.accountId,
        detail,
      });
      continue;
    }

    const stripeStatus = mapStripeStatus(stripeSub.status);
    const stripePeriodEnd = (stripeSub as Stripe.Subscription & { current_period_end?: number })
      .current_period_end
      ? new Date(
          ((stripeSub as Stripe.Subscription & { current_period_end: number })
            .current_period_end as number) * 1000,
        )
      : null;
    const stripeCancelAtPeriodEnd = stripeSub.cancel_at_period_end === true;

    const stripeSummary = {
      status: stripeStatus ?? stripeSub.status,
      currentPeriodEnd: stripePeriodEnd ? stripePeriodEnd.toISOString() : null,
      cancelAtPeriodEnd: stripeCancelAtPeriodEnd,
    };
    const localSummary = {
      status: row.status,
      currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.toISOString() : null,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    };

    // ── status drift ──────────────────────────────────────────────────
    if (stripeStatus !== row.status) {
      const statusEndsEntitlement =
        row.status === 'active' &&
        (stripeStatus === 'canceled' ||
          stripeStatus === 'unpaid' ||
          stripeStatus === 'paused' ||
          stripeStatus === null);
      const report: DriftReport = {
        accountId: row.accountId,
        stripeSubscriptionId: row.stripeSubscriptionId,
        drift: 'status-mismatch',
        local: localSummary,
        stripe: stripeSummary,
        critical: statusEndsEntitlement,
      };
      if (statusEndsEntitlement) {
        criticalCount += 1;
        logger.error(
          `[reconcile-subscriptions] CRITICAL: status drift ${row.status}→${stripeStatus} for account ${row.accountId}`,
          undefined,
          { ...report },
        );
      } else {
        logger.warn(`[reconcile-subscriptions] status drift ${row.status}→${stripeStatus}`, {
          ...report,
        });
      }
      drifts.push(report);
      continue;
    }

    // ── period_end drift ──────────────────────────────────────────────
    const localPeriodEndMs = row.currentPeriodEnd?.getTime() ?? null;
    const stripePeriodEndMs = stripePeriodEnd?.getTime() ?? null;
    if (localPeriodEndMs !== stripePeriodEndMs) {
      const report: DriftReport = {
        accountId: row.accountId,
        stripeSubscriptionId: row.stripeSubscriptionId,
        drift: 'period-end-mismatch',
        local: localSummary,
        stripe: stripeSummary,
        critical: false,
      };
      drifts.push(report);
      logger.warn(`[reconcile-subscriptions] period-end drift for account ${row.accountId}`, {
        ...report,
      });
      continue;
    }

    // ── cancel-at-period-end drift ────────────────────────────────────
    if (row.cancelAtPeriodEnd !== stripeCancelAtPeriodEnd) {
      const report: DriftReport = {
        accountId: row.accountId,
        stripeSubscriptionId: row.stripeSubscriptionId,
        drift: 'cancel-flag-mismatch',
        local: localSummary,
        stripe: stripeSummary,
        critical: false,
      };
      drifts.push(report);
      logger.warn(
        `[reconcile-subscriptions] cancel_at_period_end drift for account ${row.accountId}`,
        { ...report },
      );
    }
  }

  return c.json(
    {
      scanned: rows.length,
      drift: drifts.length,
      critical: criticalCount,
      durationMs: Date.now() - startedAt,
      results: drifts,
    },
    200,
  );
});

export default app;
