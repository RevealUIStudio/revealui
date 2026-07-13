/**
 * Cron: Reconcile Account Entitlements (GAP-356 F4 — the missing detector + healer)
 *
 * The invariant, per account with an active membership:
 *
 *   IF the local `account_subscriptions` row is HEALTHY AND FRESH
 *   OR a member holds a non-deleted `active` license
 *   THEN `account_entitlements` MUST exist with at least the matching tier.
 *
 * When it does not, a paying customer is silently gated as free — the GAP-356
 * production incident. Every other reconcile cron walks subscriptions; none
 * checked entitlements, so the defect was invisible to all of them.
 *
 * ─── Authority model (read this before changing the heal) ───────────────────
 *
 * The **local subscription row is the only heal source**, and it is authoritative
 * *only while it is fresh*. It was written by a signature-verified Stripe
 * webhook, so healing from it adds no new trust — but provenance is not
 * currency. A row frozen at `trialing` because the trial-expiry webhook failed
 * (exactly the failure class this cron backstops) would otherwise re-grant Pro
 * forever, for free. So:
 *
 *   healthy = status IN ('active','trialing')
 *             AND (current_period_end IS NULL OR current_period_end > now)
 *
 * An expired period means the row is STALE, not that the customer is entitled.
 * A stale row alerts and is never healed from.
 *
 * **Stripe is the cut-off mechanism, not the database.** To revoke access, cancel
 * the subscription in Stripe: the webhook flips the local row to a non-healthy
 * status and this cron stops healing. Hand-editing `account_entitlements`
 * (setting tier to free, or deleting the row) is NOT a supported revocation — it
 * will be healed back within a day, correctly, because a fresh healthy
 * subscription says the customer is paying.
 *
 * There is deliberately NO entitlement-status rail here. An earlier draft refused
 * to heal `revoked`/`expired`/`canceled` entitlements. That was backwards: those
 * statuses are unreachable while a subscription is healthy, and the one case the
 * rail did catch was a customer who RESUBSCRIBED after expiry and whose
 * entitlement write failed — it denied exactly the person it should have healed.
 *
 * ─── Heal rails ─────────────────────────────────────────────────────────────
 *   - Tier-monotonic UPWARD only (`isUpgrade`, sharing the single TIER_RANK in
 *     lib/downgrade-cap.ts). Downgrades stay webhook-driven.
 *   - Never heals from an unresolvable tier (F3, applied to the healer).
 *   - `last_event_at` is NULL only on INSERT, never nulled on UPDATE — NULL lets
 *     *any* event win, including a stale replay from `drain-unreconciled`.
 *   - Mode-scoped throughout: a test-mode row must never touch live entitlements.
 *   - Gated by `RECONCILE_ENTITLEMENTS_HEAL` (default ON).
 *
 * ─── Cost ───────────────────────────────────────────────────────────────────
 * Vercel Hobby allows ONE cron/day, and `dispatch.ts` runs all ~13 jobs
 * sequentially inside a single 30s function. So this job is **set-based**: one
 * scan query covering every account, then writes only for the (small) drift set.
 * An earlier draft did 4 queries per account under a 500-row cap, which both ate
 * the shared budget and silently never reconciled account 501+. It is registered
 * AFTER `sweep-grace-periods` so that even if it exhausts its budget it cannot
 * starve the cron that REVOKES access for non-payers.
 *
 * Protected by X-Cron-Secret (timing-safe compare).
 */

import { timingSafeEqual } from 'node:crypto';
import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import {
  accountEntitlements,
  accountMemberships,
  accountSubscriptions,
  licenses,
  unreconciledWebhooks,
} from '@revealui/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { sendCronFailureAlert } from '../../lib/cron-alerts.js';
import { isUpgrade } from '../../lib/downgrade-cap.js';
import {
  buildHostedEntitlementValues,
  coerceHostedTier,
  type HostedTier,
} from '../../lib/hosted-entitlement.js';

const app = new Hono();

const DRIFT_EVENT_TYPE = 'entitlement.drift';
const DRIFT_EVENT_ID_PREFIX = 'cron-entitlement-drift:';
/** Headroom inside dispatch's shared 30s budget. */
const DEFAULT_DURATION_BUDGET_MS = 8000;

const HEALTHY_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

type Outcome =
  | 'ok'
  | 'no-entitlement-source'
  | 'drift-healed'
  | 'drift-alert-only-stale-subscription'
  | 'drift-alert-only-no-subscription'
  | 'drift-alert-only-unresolvable-tier'
  | 'drift-alert-only-heal-disabled'
  | 'drift-alert-only-budget-exhausted';

interface ScanResult {
  accountId: string;
  outcome: Outcome;
  expectedTier?: HostedTier;
  actualTier?: HostedTier | null;
}

app.post('/reconcile-entitlements', async (c) => {
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

  const healEnabled = (process.env.RECONCILE_ENTITLEMENTS_HEAL ?? 'true').toLowerCase() !== 'false';
  const durationBudgetMs =
    Number.parseInt(process.env.RECONCILE_ENTITLEMENTS_BUDGET_MS ?? '', 10) ||
    DEFAULT_DURATION_BUDGET_MS;

  const db = getClient();
  const mode = getConfiguredStripeMode();
  const startedAt = Date.now();
  const now = new Date();

  // ── ONE scan query for every account with an active membership ────────────
  // Subscription and entitlement are at most one row per account (mode-scoped),
  // so the join fans out only on membership count; the license probe is folded
  // in as a correlated EXISTS rather than an N+1.
  const scanned = await db
    .selectDistinct({
      accountId: accountMemberships.accountId,
      subPlanId: accountSubscriptions.planId,
      subStatus: accountSubscriptions.status,
      subPeriodEnd: accountSubscriptions.currentPeriodEnd,
      subCustomerId: accountSubscriptions.stripeCustomerId,
      subSubscriptionId: accountSubscriptions.stripeSubscriptionId,
      entAccountId: accountEntitlements.accountId,
      entTier: accountEntitlements.tier,
      entLastEventAt: accountEntitlements.lastEventAt,
      hasActiveLicense: sql<boolean>`EXISTS (
        SELECT 1 FROM ${licenses} l
        JOIN ${accountMemberships} m2 ON m2.user_id = l.user_id
        WHERE m2.account_id = ${accountMemberships.accountId}
          AND m2.status = 'active'
          AND l.status = 'active'
          AND l.deleted_at IS NULL
          AND l.mode = ${mode}
      )`.as('has_active_license'),
    })
    .from(accountMemberships)
    .leftJoin(
      accountSubscriptions,
      and(
        eq(accountSubscriptions.accountId, accountMemberships.accountId),
        eq(accountSubscriptions.mode, mode),
      ),
    )
    .leftJoin(
      accountEntitlements,
      and(
        eq(accountEntitlements.accountId, accountMemberships.accountId),
        eq(accountEntitlements.mode, mode),
      ),
    )
    .where(eq(accountMemberships.status, 'active'));

  const results: ScanResult[] = [];
  let driftCount = 0;
  let healedCount = 0;
  let alertedCount = 0;

  for (const row of scanned) {
    const accountId = row.accountId;

    // A subscription is an entitlement source only while HEALTHY *and* FRESH.
    const statusHealthy = row.subStatus ? HEALTHY_SUBSCRIPTION_STATUSES.has(row.subStatus) : false;
    const periodFresh = !row.subPeriodEnd || row.subPeriodEnd.getTime() > now.getTime();
    const subscriptionUsable = statusHealthy && periodFresh;
    const subscriptionStale = statusHealthy && !periodFresh;
    const hasActiveLicense = row.hasActiveLicense === true;

    if (!(subscriptionUsable || subscriptionStale || hasActiveLicense)) {
      results.push({ accountId, outcome: 'no-entitlement-source' });
      continue;
    }

    const expectedTier = subscriptionUsable ? coerceHostedTier(row.subPlanId) : undefined;
    const actualTier = coerceHostedTier(row.entTier) ?? null;
    const missing = !row.entAccountId;
    const belowExpected =
      !missing && expectedTier !== undefined && actualTier !== null
        ? isUpgrade(actualTier, expectedTier)
        : false;

    if (!(missing || belowExpected)) {
      results.push({ accountId, outcome: 'ok', expectedTier, actualTier });
      continue;
    }

    driftCount += 1;

    const alerted = await recordDrift(db, {
      accountId,
      expectedTier,
      actualTier,
      customerId: row.subCustomerId ?? null,
      subscriptionId: row.subSubscriptionId ?? null,
      hasActiveLicense,
      subscriptionStale,
    });
    if (alerted) {
      alertedCount += 1;
    }

    const alertOnly = (outcome: Outcome): void => {
      results.push({ accountId, outcome, expectedTier, actualTier });
    };

    if (!healEnabled) {
      alertOnly('drift-alert-only-heal-disabled');
      continue;
    }
    // A stale row is NOT a licence to grant. Alert; never heal from it.
    if (subscriptionStale) {
      alertOnly('drift-alert-only-stale-subscription');
      continue;
    }
    // License-only: nothing safe to synthesize from. An operator resends the event.
    if (!subscriptionUsable) {
      alertOnly('drift-alert-only-no-subscription');
      continue;
    }
    // F3: never write a tier we cannot resolve.
    if (expectedTier === undefined) {
      alertOnly('drift-alert-only-unresolvable-tier');
      continue;
    }
    if (Date.now() - startedAt >= durationBudgetMs) {
      alertOnly('drift-alert-only-budget-exhausted');
      continue;
    }

    const values = buildHostedEntitlementValues({
      tier: expectedTier,
      status: row.subStatus ?? 'active',
      mode,
      graceUntil: null,
      // INSERT: NULL, so the next webhook wins over a synthesized row.
      // UPDATE: preserve the cursor — nulling it would let a STALE replayed
      // event win and re-open the WH-3 window PR-1 closed.
      lastEventAt: missing ? null : (row.entLastEventAt ?? null),
      now,
    });

    if (missing) {
      await db
        .insert(accountEntitlements)
        .values({ accountId, ...values })
        .onConflictDoNothing();
    } else {
      await db
        .update(accountEntitlements)
        .set(values)
        .where(
          and(eq(accountEntitlements.accountId, accountId), eq(accountEntitlements.mode, mode)),
        );
    }

    // The drift is gone — close our own alert row, so a FUTURE drift on this
    // account can raise a fresh one (recordDrift only suppresses on an UNRESOLVED row).
    await db
      .update(unreconciledWebhooks)
      .set({ resolvedAt: new Date(), resolvedBy: 'cron:reconcile-entitlements' })
      .where(
        and(
          eq(unreconciledWebhooks.eventId, `${DRIFT_EVENT_ID_PREFIX}${accountId}`),
          isNull(unreconciledWebhooks.resolvedAt),
        ),
      );

    healedCount += 1;
    logger.error(
      `[reconcile-entitlements] HEALED entitlement drift for account ${accountId}`,
      undefined,
      { accountId, expectedTier, actualTier, status: row.subStatus },
    );
    results.push({ accountId, outcome: 'drift-healed', expectedTier, actualTier });
  }

  // Page ops only for drift we could NOT fix. A fully-healed run is a success,
  // not an incident.
  const unhealed = driftCount - healedCount;
  if (unhealed > 0) {
    void sendCronFailureAlert({
      jobName: 'reconcile-entitlements',
      error: new Error(
        `${unhealed} account(s) with UNHEALED entitlement drift — paying customers may be gated as free`,
      ),
      severity: 'error',
      metadata: { drift: driftCount, healed: healedCount, unhealed, alerted: alertedCount },
    });
  }

  return c.json(
    {
      scanned: scanned.length,
      drift: driftCount,
      healed: healedCount,
      unhealed,
      alerted: alertedCount,
      healEnabled,
      mode,
      durationMs: Date.now() - startedAt,
      // Exceptions only — echoing every account id would be a payload and
      // log-noise problem at scale.
      results: results.filter((r) => r.outcome !== 'ok' && r.outcome !== 'no-entitlement-source'),
    },
    200,
  );
});

/**
 * Idempotent drift alert.
 *
 * The existence check is scoped to UNRESOLVED rows. A previously-resolved row
 * must not suppress a fresh alert — that is the bug that let the alert channel
 * close itself permanently after a single firing (see lib/synthetic-events.ts).
 *
 * Returns true when a new alert was raised.
 */
async function recordDrift(
  db: ReturnType<typeof getClient>,
  params: {
    accountId: string;
    expectedTier: HostedTier | undefined;
    actualTier: HostedTier | null;
    customerId: string | null;
    subscriptionId: string | null;
    hasActiveLicense: boolean;
    subscriptionStale: boolean;
  },
): Promise<boolean> {
  const eventId = `${DRIFT_EVENT_ID_PREFIX}${params.accountId}`;

  const open = await db
    .select({ eventId: unreconciledWebhooks.eventId })
    .from(unreconciledWebhooks)
    .where(and(eq(unreconciledWebhooks.eventId, eventId), isNull(unreconciledWebhooks.resolvedAt)))
    .limit(1);

  if (open.length > 0) {
    return false;
  }

  const errorTrace = [
    `Entitlement drift for account ${params.accountId}:`,
    `expected tier ${params.expectedTier ?? 'unresolvable'},`,
    `actual ${params.actualTier ?? 'NO ENTITLEMENT ROW'}.`,
    params.subscriptionStale
      ? 'The local subscription row is STALE (current_period_end has passed) and was NOT healed from — the period likely expired and the expiry webhook never landed.'
      : '',
    params.hasActiveLicense ? 'An active license is held by a member.' : '',
    'Remedy: resend the relevant Stripe event, or cancel the subscription in Stripe if the customer is no longer entitled.',
  ]
    .filter(Boolean)
    .join(' ');

  try {
    // A RESOLVED row with this id may already exist (an earlier, since-healed
    // drift). Re-open it rather than letting the PK conflict swallow the alert.
    await db
      .insert(unreconciledWebhooks)
      .values({
        eventId,
        eventType: DRIFT_EVENT_TYPE,
        customerId: params.customerId,
        stripeObjectId: params.subscriptionId,
        objectType: 'subscription',
        errorTrace,
      })
      .onConflictDoUpdate({
        target: unreconciledWebhooks.eventId,
        set: { resolvedAt: null, resolvedBy: null, errorTrace, createdAt: new Date() },
      });
    logger.error(
      `[reconcile-entitlements] entitlement drift for account ${params.accountId}`,
      undefined,
      {
        accountId: params.accountId,
        expectedTier: params.expectedTier,
        actualTier: params.actualTier,
        subscriptionStale: params.subscriptionStale,
      },
    );
    return true;
  } catch (err) {
    logger.warn(
      `[reconcile-entitlements] drift alert insert raced for ${params.accountId} — treating as already-tracked`,
      { detail: err instanceof Error ? err.message : String(err) },
    );
    return false;
  }
}

export default app;
