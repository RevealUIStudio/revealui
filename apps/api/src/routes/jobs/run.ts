/**
 * Durable work queue worker route (CR8-P2-01 phase A).
 *
 * Called via fire-and-forget wake from `enqueue()` or by the cron
 * safety-net (phase B, not yet shipped). Per invocation:
 *   1. Validate the wake secret (timing-safe compare).
 *   2. Loop until 25s of the 30s Vercel budget is consumed:
 *       a. claimNext()  — SKIP LOCKED dequeue
 *       b. getHandler() — lookup the registered handler
 *       c. Promise.race(handler, deadlineSignal(remainingBudget))
 *       d. markCompleted / markFailedOrRetry / markUnhandled
 *   3. Return a summary of jobs processed.
 *
 * @see packages/db/src/jobs/ — producer + claim primitives
 */

import { randomUUID, timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import {
  claimNext,
  DEFAULT_VISIBILITY_TIMEOUT_MS,
  deadlineSignal,
  getHandler,
  markCompleted,
  markFailedOrRetry,
  markUnhandled,
} from '@revealui/db/jobs';
import { Hono } from 'hono';

/** Up to 25s of the 30s Vercel budget — 5s reserved for the HTTP response. */
export const MAX_DURATION_MS = 25_000;
/** Upper bound on jobs processed per invocation. */
export const BATCH_SIZE = 10;
/** Safety margin before the invocation deadline. */
const LOOP_SAFETY_MARGIN_MS = 1_000;

interface JobResult {
  id: string;
  name: string;
  status: 'completed' | 'retrying' | 'failed' | 'unhandled';
  durationMs: number;
  error?: string;
  nextAttemptAt?: string;
}

const app = new Hono();

app.post('/run', async (c) => {
  if (
    !validateWakeSecret(c.req.header('X-Jobs-Wake-Secret') || c.req.header('x-jobs-wake-secret'))
  ) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const workerId = randomUUID();
  const deadline = Date.now() + MAX_DURATION_MS;
  const processed: JobResult[] = [];

  while (processed.length < BATCH_SIZE && Date.now() + LOOP_SAFETY_MARGIN_MS < deadline) {
    const claim = await claimNext({
      workerId,
      visibilityTimeoutMs: DEFAULT_VISIBILITY_TIMEOUT_MS,
    });
    if (!claim) break;

    const start = Date.now();
    const remainingBudget = deadline - start - LOOP_SAFETY_MARGIN_MS;

    const handler = getHandler(claim.name);
    if (!handler) {
      await markUnhandled(claim.id, claim.name);
      processed.push({
        id: claim.id,
        name: claim.name,
        status: 'unhandled',
        durationMs: 0,
        error: `no handler registered for '${claim.name}'`,
      });
      logger.warn('[jobs.run] no handler registered', {
        jobId: claim.id,
        jobName: claim.name,
      });
      continue;
    }

    try {
      const output = await Promise.race([
        handler(claim.data, claim),
        deadlineSignal(remainingBudget),
      ]);
      await markCompleted(claim.id, toOutput(output));
      processed.push({
        id: claim.id,
        name: claim.name,
        status: 'completed',
        durationMs: Date.now() - start,
      });
      logger.info('[jobs.run] completed', {
        jobId: claim.id,
        jobName: claim.name,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      const decision = await markFailedOrRetry(claim.id, err);
      processed.push({
        id: claim.id,
        name: claim.name,
        status: decision.kind === 'retry' ? 'retrying' : 'failed',
        durationMs: Date.now() - start,
        error: decision.error,
        nextAttemptAt:
          decision.nextAttemptAt !== undefined
            ? new Date(decision.nextAttemptAt).toISOString()
            : undefined,
      });
      logger.warn('[jobs.run] handler failed', {
        jobId: claim.id,
        jobName: claim.name,
        retryCount: decision.retryCount,
        kind: decision.kind,
        error: decision.error,
      });
    }
  }

  return c.json({
    workerId,
    processedCount: processed.length,
    processed,
    budgetRemainingMs: Math.max(0, deadline - Date.now()),
  });
});

/**
 * Validate X-Jobs-Wake-Secret against REVEALUI_JOBS_WAKE_SECRET using a
 * timing-safe compare. Missing-secret server-side = reject (never allow
 * worker access without configured auth).
 */
function validateWakeSecret(provided: string | undefined): boolean {
  const configured = process.env.REVEALUI_JOBS_WAKE_SECRET;
  if (!(configured && provided)) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(configured);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Normalize a handler's return value into the JSONB-shaped output column.
 * Handlers commonly return a plain object; void/undefined becomes null;
 * primitives are wrapped so the column stays object-shaped.
 */
function toOutput(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

export default app;
