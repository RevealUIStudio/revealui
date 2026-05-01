/**
 * Cron: Jobs Queue Safety Net (CR8-P2-01 phase B)
 *
 * Two-part handler — runs on every cron dispatch tick:
 *   1. Reclaim stalled claims (state='active' with locked_until < now()).
 *      A stalled row indicates the worker crashed or hung mid-job; we
 *      transition it back to state='created' with retry_count + 1 and a
 *      diagnostic last_error so the usual retry/DLQ logic applies on the
 *      next claim attempt.
 *   2. Wake the worker if any jobs are due but not being processed
 *      (state='created' AND start_after <= now()). Covers the case where
 *      the fan-out wake from enqueue() was swallowed (network glitch, pod
 *      restart) — the worker now gets a second chance without needing to
 *      wait for the next cron tick.
 *
 * Protected by X-Cron-Secret header (defense-in-depth — also validated
 * in dispatch.ts). Same pattern as cron/cleanup.ts.
 *
 * NOTE on cron frequency: the existing dispatcher runs daily at 06:00
 * UTC. A daily safety-net floor is acceptable for initial ship because
 * the fan-out wake from enqueue() handles low-latency cases. Upgrading
 * to `* / 5 * * * *` (Vercel Pro required) is a separate tracker and
 * NOT in scope for this phase.
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { countEligible, reclaimStalled, wakeWorker } from '@revealui/db/jobs';
import { Hono } from 'hono';

const app = new Hono();

app.post('/jobs-safety-net', async (c) => {
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

  // --- Part 1: reclaim stalled claims --------------------------------------
  let reclaimedCount = 0;
  try {
    const reclaimed = await reclaimStalled();
    reclaimedCount = reclaimed.length;
    if (reclaimedCount > 0) {
      logger.warn('[cron-jobs-safety-net] Reclaimed stalled job claims', {
        count: reclaimedCount,
        jobs: reclaimed.map((job) => ({
          id: job.id,
          name: job.name,
          retryCount: job.retryCount,
          previousLockedBy: job.previousLockedBy,
        })),
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[cron-jobs-safety-net] reclaimStalled failed: ${message}`);
    return c.json({ success: false, error: 'reclaimStalled failed' }, 500);
  }

  // --- Part 2: wake worker if work is due ----------------------------------
  let eligibleCount = 0;
  let wakeFired = false;
  try {
    eligibleCount = await countEligible();
    if (eligibleCount > 0) {
      // wakeWorker is fire-and-forget internally; any error is swallowed
      // (matches producer semantics — the next cron tick retries).
      await wakeWorker(null).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(`[cron-jobs-safety-net] wake fetch failed (non-fatal): ${message}`);
      });
      wakeFired = true;
      logger.info('[cron-jobs-safety-net] Fired wake for due work', {
        eligibleCount,
      });
    }
  } catch (err) {
    // countEligible failure is non-fatal — we already did the reclaim.
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[cron-jobs-safety-net] wakeIfWorkDue failed: ${message}`);
  }

  return c.json({
    success: true,
    reclaimedCount,
    eligibleCount,
    wakeFired,
  });
});

export default app;
