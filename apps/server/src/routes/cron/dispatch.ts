/**
 * Cron Dispatcher
 *
 * Consolidates all cron jobs into a single endpoint for Vercel Hobby plan
 * (limited to 1 cron per day). Runs each handler sequentially and
 * aggregates results.
 *
 * Vercel platform crons GET /api/cron/dispatch (daily at 06:00 UTC) and send
 * Authorization: Bearer CRON_SECRET. Manual / WSL invocation remains
 * POST /api/cron/dispatch with X-Cron-Secret: REVEALUI_CRON_SECRET.
 *
 * Dispatch accepts either token (timing-safe, fail-closed). Sub-jobs are
 * always invoked with X-Cron-Secret: REVEALUI_CRON_SECRET. They compare
 * against that env, not Vercel's Bearer CRON_SECRET.
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { Hono } from 'hono';
import billingApp from '../billing.js';
import billingReadinessApp from './billing-readiness.js';
import cleanupApp from './cleanup.js';
import cogsBreakerApp from './cogs-breaker.js';
import drainUnreconciledApp from './drain-unreconciled.js';
import jobsSafetyNetApp from './jobs-safety-net.js';
import lifecycleEmailsApp from './lifecycle-emails.js';
import marginSnapshotApp from './margin-snapshot.js';
import marketplacePayoutsApp from './marketplace-payouts.js';
import publishScheduledApp from './publish-scheduled.js';
import reconcileCustomersApp from './reconcile-customers.js';
import reconcileEntitlementsApp from './reconcile-entitlements.js';
import reconcileStripeSubscriptionsApp from './reconcile-stripe-subscriptions.js';
import reconcileSubscriptionsApp from './reconcile-subscriptions.js';
import sweepGracePeriodsApp from './sweep-grace-periods.js';
import uptimeCheckApp from './uptime-check.js';

const app = new Hono();

const BEARER_PREFIX = 'Bearer ';

interface JobResult {
  name: string;
  status: number;
  body: unknown;
  durationMs: number;
}

function timingSafeMatch(provided: string, secret: string | undefined): boolean {
  if (!secret) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function extractCronToken(c: {
  req: { header: (name: string) => string | undefined };
}): string | undefined {
  const headerSecret = c.req.header('X-Cron-Secret') || c.req.header('x-cron-secret');
  if (headerSecret) return headerSecret;

  const authorization = c.req.header('Authorization') || c.req.header('authorization');
  if (!authorization?.startsWith(BEARER_PREFIX)) return undefined;
  const token = authorization.slice(BEARER_PREFIX.length);
  return token.length > 0 ? token : undefined;
}

function authorizeCronDispatch(c: {
  req: { header: (name: string) => string | undefined };
}): boolean {
  const provided = extractCronToken(c);
  if (!provided) return false;
  const revealuiOk = timingSafeMatch(provided, process.env.REVEALUI_CRON_SECRET);
  const vercelOk = timingSafeMatch(provided, process.env.CRON_SECRET);
  return revealuiOk || vercelOk;
}

const JOBS = [
  // drain-unreconciled runs first so any failed webhook replays land back in
  // the accounting DB before billing-readiness evaluates price parity and
  // sweep-grace-periods transitions past_due → expired.
  { name: 'drain-unreconciled', app: drainUnreconciledApp, path: '/drain-unreconciled' },
  // reconcile-subscriptions follows so any drift we detect (e.g. Stripe says
  // past_due, we say active) surfaces in logs before sweep-grace-periods
  // acts on our stored state.
  {
    name: 'reconcile-subscriptions',
    app: reconcileSubscriptionsApp,
    path: '/reconcile-subscriptions',
  },
  // reconcile-customers follows reconcile-subscriptions so the Stripe→local
  // walk runs while reconcile-subscriptions' drift logs are still adjacent
  // in the dispatcher output. Surface 10 Gap B / GAP-143 — alert-only orphan
  // detection. Writes rows to `unreconciledWebhooks` keyed by
  // `cron-orphan:<customerId>`; the next dispatcher tick's
  // `drain-unreconciled` will see them with a `customer.orphaned` event_type
  // (which it cannot replay — drain-unreconciled is signature-bound to real
  // Stripe events, so these rows surface to ops via the dashboard / aged
  // alert path).
  { name: 'reconcile-customers', app: reconcileCustomersApp, path: '/reconcile-customers' },
  // reconcile-stripe-subscriptions walks Stripe subscriptions INWARD and flags
  // any LIVE sub with no `accountSubscriptions` row — hosted entitlement state
  // that was never created (e.g. a checkout.session.completed webhook that
  // failed during an outage), which the OUTWARD-walking crons cannot see.
  // Alert-only: writes `subscription.unsynced` rows to `unreconciledWebhooks`.
  {
    name: 'reconcile-stripe-subscriptions',
    app: reconcileStripeSubscriptionsApp,
    path: '/reconcile-stripe-subscriptions',
  },
  { name: 'billing-readiness', app: billingReadinessApp, path: '/billing-readiness' },
  { name: 'publish-scheduled', app: publishScheduledApp, path: '/publish-scheduled' },
  { name: 'sweep-grace-periods', app: sweepGracePeriodsApp, path: '/sweep-grace-periods' },
  // reconcile-entitlements (GAP-356 F4) checks the one invariant none of the
  // crons above cover: a healthy, FRESH subscription (or an active license) MUST
  // have a matching `account_entitlements` row. Alerts on drift; heals upward
  // from the local subscription row.
  //
  // It runs AFTER sweep-grace-periods on purpose. All ~13 jobs share ONE 30s
  // function (Vercel Hobby allows a single daily cron), so a job that overruns
  // starves every job behind it. sweep-grace-periods is the cron that EXPIRES
  // access for non-payers; letting a healer that GRANTS access run ahead of the
  // revoker means a bad day for the healer becomes a free-access day for
  // everyone who stopped paying. Revoke first, then heal.
  //
  // Running after the sweep also means this job sees the sweep's own
  // expirations, so it will not re-grant what was just expired: the sweep sets
  // account_subscriptions.status = 'expired', which fails the healthy check.
  {
    name: 'reconcile-entitlements',
    app: reconcileEntitlementsApp,
    path: '/reconcile-entitlements',
  },
  { name: 'marketplace-payouts', app: marketplacePayoutsApp, path: '/marketplace-payouts' },
  { name: 'cleanup', app: cleanupApp, path: '/cleanup' },
  // GAP-256 PR-2: margin snapshot (free/paid COGS + MRR daily). No-op unless
  // MARGIN_SNAPSHOT_CRON_ENABLED=true. Runs via this single Hobby cron path
  // (not a second vercel.json cron entry).
  { name: 'margin-snapshot', app: marginSnapshotApp, path: '/margin-snapshot' },
  { name: 'cogs-breaker', app: cogsBreakerApp, path: '/cogs-breaker' },
  // lifecycle-emails evaluates onboarding day-0/day-1/day-7 sends for Pro/Max.
  // Hosted test arms when the Gmail mailbox path is present; production stays
  // disarmed unless LIFECYCLE_EMAILS_ENABLED=true. Missing mailbox fails closed.
  { name: 'lifecycle-emails', app: lifecycleEmailsApp, path: '/lifecycle-emails' },
  { name: 'uptime-check', app: uptimeCheckApp, path: '/uptime-check' },
  { name: 'jobs-safety-net', app: jobsSafetyNetApp, path: '/jobs-safety-net' },
  // report-agent-overage emits previous-cycle agent_task_overage to Stripe
  // Billing Meters via protectedStripe.billing.meterEvents.create. Idempotent
  // per (userId, prevCycle) so daily firings collapse to one charge per cycle.
  // No-op until STRIPE_AGENT_OVERAGE_PRICE_ID + STRIPE_AGENT_METER_EVENT_NAME
  // are set AND active subscriptions carry the metered item.
  { name: 'report-agent-overage', app: billingApp, path: '/report-agent-overage' },
];

app.on(['GET', 'POST'], '/dispatch', async (c) => {
  if (!authorizeCronDispatch(c)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  logger.info('[cron-dispatch] Starting consolidated cron run');

  const results: JobResult[] = [];
  const fanoutSecret = process.env.REVEALUI_CRON_SECRET;
  const fanoutHeaders: Record<string, string> = fanoutSecret
    ? { 'X-Cron-Secret': fanoutSecret }
    : {};

  for (const job of JOBS) {
    const start = Date.now();
    try {
      const req = new Request(`http://localhost${job.path}`, {
        method: 'POST',
        headers: fanoutHeaders,
      });
      const res = await job.app.fetch(req);
      const body = await res.json();
      results.push({
        name: job.name,
        status: res.status,
        body,
        durationMs: Date.now() - start,
      });
      logger.info(`[cron-dispatch] ${job.name}: ${res.status} (${Date.now() - start}ms)`);
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        name: job.name,
        status: 500,
        body: { error: message },
        durationMs,
      });
      logger.error(`[cron-dispatch] ${job.name} failed: ${message} (${durationMs}ms)`);
    }
  }

  const failed = results.filter((r) => r.status >= 400);
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  logger.info(
    `[cron-dispatch] Complete: ${results.length} jobs, ${failed.length} failed, ${totalMs}ms total`,
  );

  return c.json({
    status: failed.length === 0 ? 'ok' : 'partial',
    jobs: results.length,
    failed: failed.length,
    totalMs,
    results,
    dispatchedAt: new Date().toISOString(),
  });
});

export default app;
