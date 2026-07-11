/**
 * Cron Dispatcher
 *
 * Consolidates all cron jobs into a single endpoint for Vercel Hobby plan
 * (limited to 1 cron per day). Runs each handler sequentially and
 * aggregates results.
 *
 * Vercel calls: POST /api/cron/dispatch (daily at 06:00 UTC)
 *
 * Each sub-handler is called internally via its Hono app instance,
 * so the CRON_SECRET is validated once here and forwarded.
 *
 * Protected by X-Cron-Secret header.
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { Hono } from 'hono';
import billingApp from '../billing.js';
import billingReadinessApp from './billing-readiness.js';
import cleanupApp from './cleanup.js';
import drainUnreconciledApp from './drain-unreconciled.js';
import jobsSafetyNetApp from './jobs-safety-net.js';
import lifecycleEmailsApp from './lifecycle-emails.js';
import marketplacePayoutsApp from './marketplace-payouts.js';
import publishScheduledApp from './publish-scheduled.js';
import reconcileCustomersApp from './reconcile-customers.js';
import reconcileStripeSubscriptionsApp from './reconcile-stripe-subscriptions.js';
import reconcileSubscriptionsApp from './reconcile-subscriptions.js';
import sweepGracePeriodsApp from './sweep-grace-periods.js';
import uptimeCheckApp from './uptime-check.js';

const app = new Hono();

interface JobResult {
  name: string;
  status: number;
  body: unknown;
  durationMs: number;
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
  { name: 'marketplace-payouts', app: marketplacePayoutsApp, path: '/marketplace-payouts' },
  { name: 'cleanup', app: cleanupApp, path: '/cleanup' },
  // lifecycle-emails evaluates onboarding day-0/day-1/day-7 sends. Disarmed by
  // default (LIFECYCLE_EMAILS_ENABLED must be 'true' to call the transport);
  // otherwise it only records would-send decisions.
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

app.post('/dispatch', async (c) => {
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

  logger.info('[cron-dispatch] Starting consolidated cron run');

  const results: JobResult[] = [];

  for (const job of JOBS) {
    const start = Date.now();
    try {
      const req = new Request(`http://localhost${job.path}`, {
        method: 'POST',
        headers: { 'X-Cron-Secret': provided },
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
