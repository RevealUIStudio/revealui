/**
 * Durable-queue handler registration (CR8-P2-01 phase C).
 *
 * Imported for side-effect at module top-level in apps/server/src/index.ts
 * so every Vercel invocation — including the worker route at
 * /api/jobs/run — has the handlers registered before any job is
 * claimed.
 *
 * Why top-level: Vercel cold-start re-imports the entry module and its
 * top-level statements re-run. Registering inside a route handler
 * would miss the worker invocation that claims the job (it doesn't
 * go through the producer's route).
 */

import { registerHandler } from '@revealui/db/jobs';
import { type AgentDispatchPayload, agentDispatchHandler } from './agent-dispatch.js';

// Register idempotently: double-import (test harness + prod boot) is a
// no-op because registerHandler throws on duplicates. The try/catch
// downgrades that to a warning — two modules both importing this file
// shouldn't crash the app.
try {
  registerHandler<AgentDispatchPayload, Awaited<ReturnType<typeof agentDispatchHandler>>>(
    'agent.dispatch',
    agentDispatchHandler,
  );
} catch (err) {
  // Already registered (re-import in hot-reload or test). Ignore.
  if (!(err instanceof Error && err.message.includes('already registered'))) {
    throw err;
  }
}

/**
 * Boot-time assertion: when the queue-based dispatch flag is on, the
 * wake secret MUST be configured. Without the wake secret, the
 * producer's fan-out call to /api/jobs/run fires no-op and the job
 * waits for the cron safety-net — which runs daily. End result: every
 * dispatch appears to hang for up to 24 hours. Fail fast instead.
 */
export function assertDispatchFlagConfigured(): void {
  const flagOn = process.env.REVEALUI_JOBS_AGENT_DISPATCH_ENABLED === 'true';
  if (!flagOn) return;
  const secret = process.env.REVEALUI_JOBS_WAKE_SECRET;
  if (!secret) {
    throw new Error(
      'REVEALUI_JOBS_AGENT_DISPATCH_ENABLED=true requires REVEALUI_JOBS_WAKE_SECRET to be set. ' +
        'Without the wake secret, enqueued dispatches wait for the daily cron tick instead of ' +
        'running immediately. Set both or unset the flag.',
    );
  }
}
