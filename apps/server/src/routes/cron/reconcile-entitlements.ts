/**
 * Cron: Reconcile Account Entitlements (GAP-356 F4 — the missing detector + healer)
 *
 * The invariant, checked per account with at least one active membership:
 *
 *   IF `account_subscriptions` has a healthy row (`active`/`trialing`)
 *   OR a member holds a non-deleted `active` license
 *   THEN `account_entitlements` MUST exist with the matching tier.
 *
 * When it does not, a paying customer is silently gated as free. That is the
 * GAP-356 production incident: a real Pro trial resolved to `free` forever
 * because the entitlement write never landed, and nothing in the fleet noticed.
 * Every existing reconcile cron walks subscriptions; none checked entitlements,
 * so the defect was invisible to all of them.
 *
 * On violation:
 *   (a) ALERT — an idempotent `unreconciledWebhooks` row (`event_type:
 *       'entitlement.drift'`, synthetic `event_id` so re-runs collide).
 *   (b) HEAL — synthesize the entitlement FROM THE LOCAL SUBSCRIPTION ROW ONLY.
 *
 * Why local-only: the local subscription row was written by a signature-verified
 * Stripe webhook. Healing from it adds no new trust. Healing from a raw Stripe
 * read would widen the attack surface to anyone who can create Stripe objects —
 * which is exactly why `reconcile-stripe-subscriptions` stayed alert-only.
 *
 * Heal safety rails:
 *   - **Tier-monotonic UPWARD only.** A heal may raise a tier, never lower one.
 *     Downgrades are a business decision and stay webhook-driven.
 *   - **Never resurrects a terminal entitlement.** If the existing row is
 *     `revoked`/`expired`/`canceled`, we alert but do NOT heal. Healing it would
 *     re-grant access to an account someone deliberately cut off, which is the
 *     resurrection vector the WH-3 staleness guard exists to prevent. A stale
 *     local subscription row must never be able to undo a revocation.
 *   - **`last_event_at` is written NULL on healed rows**, so the very next
 *     webhook — whatever its `event.created` — wins over the heal. A healed row
 *     can never make a real event look stale.
 *   - Heal is gated by `RECONCILE_ENTITLEMENTS_HEAL` (default ON). Set it to
 *     'false' to run detector-only.
 *
 * Protected by X-Cron-Secret (timing-safe compare), same gate as the sibling
 * reconciliation crons.
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import {
  accountEntitlements,
  accountMemberships,
  accountSubscriptions,
  licenses,
  unreconciledWebhooks,
} from '@revealui/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { sendCronFailureAlert } from '../../lib/cron-alerts.js';
import {
  buildHostedEntitlementValues,
  coerceHostedTier,
  type HostedTier,
  isTierUpgrade,
} from '../../lib/hosted-entitlement.js';

const app = new Hono();

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 2000;
const DRIFT_EVENT_TYPE = 'entitlement.drift';

/** Subscription statuses that entitle the account to access. */
const HEALTHY_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

/**
 * Entitlement statuses that must NOT be healed back to life. A row in one of
 * these states was deliberately cut off; a cron inferring from a possibly-stale
 * local subscription row has no business re-granting it.
 */
const TERMINAL_ENTITLEMENT_STATUSES = new Set(['revoked', 'expired', 'canceled']);

type Outcome =
  | 'ok'
  | 'no-entitlement-source'
  | 'drift-healed'
  | 'drift-alert-only-no-subscription'
  | 'drift-alert-only-unresolvable-tier'
  | 'drift-alert-only-terminal'
  | 'drift-alert-only-heal-disabled';

interface AccountScanResult {
  accountId: string;
  outcome: Outcome;
  expectedTier?: HostedTier;
  actualTier?: HostedTier | null;
}

app.post('/reconcile-entitlements', async (c) => {
  // ── auth gate (mirrors the sibling reconcile crons) ───────────────────
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

  const batchSize = Math.min(
    Number.parseInt(process.env.RECONCILE_ENTITLEMENTS_BATCH_SIZE ?? '', 10) || DEFAULT_BATCH_SIZE,
    MAX_BATCH_SIZE,
  );
  // Default ON. Only an explicit 'false' disables healing.
  const healEnabled = (process.env.RECONCILE_ENTITLEMENTS_HEAL ?? 'true').toLowerCase() !== 'false';

  const db = getClient();
  const startedAt = Date.now();

  // ── accounts with at least one active membership ──────────────────────
  const activeAccounts = await db
    .selectDistinct({ accountId: accountMemberships.accountId })
    .from(accountMemberships)
    .where(eq(accountMemberships.status, 'active'))
    .limit(batchSize);

  const results: AccountScanResult[] = [];
  let driftCount = 0;
  let healedCount = 0;
  let alertedCount = 0;

  for (const { accountId } of activeAccounts) {
    // ── the entitlement SOURCES: a healthy local subscription, or an active
    //    license held by an active member ───────────────────────────────
    const [subscription] = await db
      .select({
        planId: accountSubscriptions.planId,
        status: accountSubscriptions.status,
        mode: accountSubscriptions.mode,
        stripeCustomerId: accountSubscriptions.stripeCustomerId,
        stripeSubscriptionId: accountSubscriptions.stripeSubscriptionId,
      })
      .from(accountSubscriptions)
      .where(eq(accountSubscriptions.accountId, accountId))
      .limit(1);

    const healthySubscription =
      subscription && HEALTHY_SUBSCRIPTION_STATUSES.has(subscription.status)
        ? subscription
        : undefined;

    const memberIds = await db
      .select({ userId: accountMemberships.userId })
      .from(accountMemberships)
      .where(
        and(eq(accountMemberships.accountId, accountId), eq(accountMemberships.status, 'active')),
      );

    let hasActiveLicense = false;
    if (memberIds.length > 0) {
      const held = await db
        .select({ id: licenses.id })
        .from(licenses)
        .where(
          and(
            inArray(
              licenses.userId,
              memberIds.map((m) => m.userId),
            ),
            eq(licenses.status, 'active'),
            isNull(licenses.deletedAt),
          ),
        )
        .limit(1);
      hasActiveLicense = held.length > 0;
    }

    // No entitlement source at all → the account is legitimately free.
    // This is the "entitlements=free + no healthy subscription/license" case:
    // NOT drift, and explicitly NOT healed.
    if (!(healthySubscription || hasActiveLicense)) {
      results.push({ accountId, outcome: 'no-entitlement-source' });
      continue;
    }

    // ── the expected tier comes ONLY from the local subscription row ─────
    const expectedTier = coerceHostedTier(healthySubscription?.planId);

    const [entitlement] = await db
      .select({
        accountId: accountEntitlements.accountId,
        tier: accountEntitlements.tier,
        status: accountEntitlements.status,
      })
      .from(accountEntitlements)
      .where(eq(accountEntitlements.accountId, accountId))
      .limit(1);

    const actualTier = coerceHostedTier(entitlement?.tier) ?? null;

    // ── is the invariant satisfied? ───────────────────────────────────────
    // Satisfied when an entitlement row exists AND (we have no expected tier to
    // compare against, OR the row is already at least the expected tier).
    const missing = !entitlement;
    const belowExpected =
      !missing && expectedTier !== undefined && actualTier !== null
        ? isTierUpgrade(actualTier, expectedTier)
        : false;

    if (!(missing || belowExpected)) {
      results.push({ accountId, outcome: 'ok', expectedTier, actualTier });
      continue;
    }

    // ── DRIFT ─────────────────────────────────────────────────────────────
    driftCount += 1;

    const alerted = await recordDrift(db, {
      accountId,
      expectedTier,
      actualTier,
      customerId: healthySubscription?.stripeCustomerId ?? null,
      subscriptionId: healthySubscription?.stripeSubscriptionId ?? null,
      hasActiveLicense,
    });
    if (alerted) {
      alertedCount += 1;
    }

    // ── can we heal? ──────────────────────────────────────────────────────
    if (!healEnabled) {
      results.push({
        accountId,
        outcome: 'drift-alert-only-heal-disabled',
        expectedTier,
        actualTier,
      });
      continue;
    }

    // Heal source is the LOCAL SUBSCRIPTION ROW ONLY. A license-only account
    // (no healthy subscription row) has nothing safe to synthesize from.
    if (!healthySubscription) {
      results.push({
        accountId,
        outcome: 'drift-alert-only-no-subscription',
        expectedTier,
        actualTier,
      });
      continue;
    }

    // Refuse to write a tier we cannot resolve — the F3 "never write from
    // ignorance" rule applies to the healer exactly as it does to the webhook.
    if (expectedTier === undefined) {
      results.push({
        accountId,
        outcome: 'drift-alert-only-unresolvable-tier',
        expectedTier,
        actualTier,
      });
      continue;
    }

    // Never resurrect a deliberately terminated entitlement.
    if (entitlement && TERMINAL_ENTITLEMENT_STATUSES.has(entitlement.status)) {
      logger.warn(
        '[reconcile-entitlements] drift on a terminal entitlement — alerting without healing (refusing to resurrect a revoked/expired/canceled row)',
        { accountId, entitlementStatus: entitlement.status, expectedTier },
      );
      results.push({ accountId, outcome: 'drift-alert-only-terminal', expectedTier, actualTier });
      continue;
    }

    const now = new Date();
    const values = buildHostedEntitlementValues({
      tier: expectedTier,
      status: healthySubscription.status,
      mode: healthySubscription.mode === 'test' ? 'test' : 'live',
      graceUntil: null,
      // NULL by design: the next webhook must always win over a healed row.
      lastEventAt: null,
      now,
    });

    if (entitlement) {
      await db
        .update(accountEntitlements)
        .set(values)
        .where(eq(accountEntitlements.accountId, accountId));
    } else {
      await db
        .insert(accountEntitlements)
        .values({ accountId, ...values })
        .onConflictDoNothing();
    }

    healedCount += 1;
    logger.error(
      `[reconcile-entitlements] HEALED entitlement drift for account ${accountId}`,
      undefined,
      { accountId, expectedTier, actualTier, status: healthySubscription.status },
    );
    results.push({ accountId, outcome: 'drift-healed', expectedTier, actualTier });
  }

  if (driftCount > 0) {
    void sendCronFailureAlert({
      jobName: 'reconcile-entitlements',
      error: new Error(
        `CRITICAL: ${driftCount} account(s) with entitlement drift — paying customers may be gated as free`,
      ),
      severity: 'error',
      metadata: { drift: driftCount, healed: healedCount, alerted: alertedCount },
    });
  }

  return c.json(
    {
      scanned: activeAccounts.length,
      drift: driftCount,
      healed: healedCount,
      alerted: alertedCount,
      healEnabled,
      durationMs: Date.now() - startedAt,
      results,
    },
    200,
  );
});

/**
 * Idempotent drift alert. The synthetic event_id collides on re-runs, so a
 * standing drift does not spam a new row every tick.
 *
 * Returns true when a NEW alert row was written.
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
  },
): Promise<boolean> {
  const syntheticEventId = `cron-entitlement-drift:${params.accountId}`;

  const existing = await db
    .select({ eventId: unreconciledWebhooks.eventId })
    .from(unreconciledWebhooks)
    .where(eq(unreconciledWebhooks.eventId, syntheticEventId))
    .limit(1);

  if (existing.length > 0) {
    return false;
  }

  const errorTrace = [
    `Entitlement drift for account ${params.accountId}:`,
    `expected tier ${params.expectedTier ?? 'unresolvable'},`,
    `actual ${params.actualTier ?? 'NO ENTITLEMENT ROW'}.`,
    params.hasActiveLicense ? 'An active license is held by a member.' : '',
    'A paying customer is being gated below what they bought.',
    'Remedy: the reconciler heals from the local subscription row when it can;',
    'if it could not, resend the checkout.session.completed event from Stripe.',
  ]
    .filter(Boolean)
    .join(' ');

  try {
    await db
      .insert(unreconciledWebhooks)
      .values({
        eventId: syntheticEventId,
        eventType: DRIFT_EVENT_TYPE,
        customerId: params.customerId,
        stripeObjectId: params.subscriptionId,
        objectType: 'subscription',
        errorTrace,
      })
      .onConflictDoNothing();
    logger.error(
      `[reconcile-entitlements] CRITICAL: entitlement drift for account ${params.accountId}`,
      undefined,
      {
        accountId: params.accountId,
        expectedTier: params.expectedTier,
        actualTier: params.actualTier,
      },
    );
    return true;
  } catch (err) {
    // Two ticks can race on the same synthetic id; the loser is fine — the row
    // is the goal, not who wrote it.
    logger.warn(
      `[reconcile-entitlements] drift alert insert raced for ${params.accountId} — treating as already-tracked`,
      { detail: err instanceof Error ? err.message : String(err) },
    );
    return false;
  }
}

export default app;
