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
import billingReadinessApp from './billing-readiness.js';
import cleanupApp from './cleanup.js';
import jobsSafetyNetApp from './jobs-safety-net.js';
import marketplacePayoutsApp from './marketplace-payouts.js';
import publishScheduledApp from './publish-scheduled.js';
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
  { name: 'billing-readiness', app: billingReadinessApp, path: '/billing-readiness' },
  { name: 'publish-scheduled', app: publishScheduledApp, path: '/publish-scheduled' },
  { name: 'sweep-grace-periods', app: sweepGracePeriodsApp, path: '/sweep-grace-periods' },
  { name: 'marketplace-payouts', app: marketplacePayoutsApp, path: '/marketplace-payouts' },
  { name: 'cleanup', app: cleanupApp, path: '/cleanup' },
  { name: 'uptime-check', app: uptimeCheckApp, path: '/uptime-check' },
  { name: 'jobs-safety-net', app: jobsSafetyNetApp, path: '/jobs-safety-net' },
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
