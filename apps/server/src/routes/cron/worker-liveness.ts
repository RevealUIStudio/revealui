/**
 * Cron: Fly Worker Liveness Probe (GAP-443)
 *
 * Probes the Fly worker's public `/health` endpoint from the Vercel `api`
 * project. This is the external liveness watcher: if the worker goes dark,
 * nothing on the worker itself can page anyone, so a separate deployment has
 * to do the probing.
 *
 * Chosen as a PRIVATE Vercel cron (this route) over a public status-page
 * service (e.g. Upptime) specifically to keep the worker's hostname out of
 * the public `revealui` repo. Consequently the target URL is read from
 * `REVEALUI_WORKER_HEALTH_URL` at runtime and is NEVER hardcoded, logged, or
 * included in alert text  -  only the observed status/error is reported.
 *
 * Fetches through `createSafeFetch()` (SSRF-guarded: rejects private/reserved
 * IPs, pins the resolved address, refuses redirects) with a 10s timeout.
 *
 * Piggybacks on the daily cron dispatcher for a baseline check (Vercel Hobby
 * allows one cron/day  -  see `dispatch.ts`). Also exposed directly at
 * `/api/cron/worker-liveness` so an external scheduler (GitHub Actions,
 * Upstash Cron, etc.) can drive it every few minutes without requiring a
 * Vercel Pro plan, matching the `drain-unreconciled` / `jobs-safety-net`
 * precedent for sub-daily cadence on this plan.
 *
 * Sends an alert via `sendCronFailureAlert` (log + Sentry + email to
 * `REVEALUI_ALERT_EMAIL`) on any non-200 response, timeout, or network error.
 *
 * Protected by X-Cron-Secret header (timing-safe compare).
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { createSafeFetch } from '@revealui/security/server';
import { Hono } from 'hono';
import { sendCronFailureAlert } from '../../lib/cron-alerts.js';

const app = new Hono();

const HEALTH_CHECK_TIMEOUT_MS = 10_000;

const safeFetch = createSafeFetch();

app.post('/worker-liveness', async (c) => {
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

  const checkedAt = new Date().toISOString();
  const healthUrl = process.env.REVEALUI_WORKER_HEALTH_URL;

  if (!healthUrl) {
    // Deliberately no fallback URL  -  this is a public repo and the worker
    // hostname must never be hardcoded. Unset is a supported no-op, not an
    // error: it lets the route ship ahead of the owner setting the var.
    logger.info('[worker-liveness] REVEALUI_WORKER_HEALTH_URL unset, probe skipped');
    return c.json({ skipped: true, checkedAt }, 200);
  }

  try {
    const response = await safeFetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });

    if (response.status === 200) {
      logger.info('[worker-liveness] worker healthy', { status: response.status });
      return c.json({ healthy: true, status: response.status, checkedAt }, 200);
    }

    logger.error('[worker-liveness] worker returned non-200 status', undefined, {
      status: response.status,
    });
    void sendCronFailureAlert({
      jobName: 'worker-liveness',
      error: new Error(`Worker liveness check returned non-200 status: ${response.status}`),
      severity: 'error',
      metadata: { status: response.status },
    });
    return c.json({ healthy: false, status: response.status, checkedAt }, 503);
  } catch (err) {
    // Never forward the caught error's message  -  the SSRF guard and
    // network-error paths can embed the target hostname in their text, and
    // that must not reach logs or the alert email.
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    const reason = isTimeout ? 'timeout' : 'network-error';

    logger.error(`[worker-liveness] worker unreachable (${reason})`, undefined, { reason });
    void sendCronFailureAlert({
      jobName: 'worker-liveness',
      error: new Error(
        isTimeout
          ? `Worker liveness check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`
          : 'Worker liveness check failed: network error',
      ),
      severity: 'error',
      metadata: { reason },
    });
    return c.json({ healthy: false, error: reason, checkedAt }, 503);
  }
});

export default app;
