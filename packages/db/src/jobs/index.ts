/**
 * @revealui/db/jobs — durable work queue primitive (CR8-P2-01 phase A)
 *
 * Producer:
 * ```typescript
 * import { enqueue } from '@revealui/db/jobs';
 * await enqueue('agent.dispatch', { ticketId }, { idempotencyKey: `dispatch:${ticketId}` });
 * ```
 *
 * Handler registration (at app boot):
 * ```typescript
 * import { registerHandler } from '@revealui/db/jobs';
 * registerHandler('agent.dispatch', async (data, job) => { ... });
 * ```
 *
 * Worker loop (apps/api/src/routes/jobs/run.ts) — claims + dispatches.
 */

export type { ClaimOptions, DbOverride, RetryDecision } from './claim.js';
export {
  claimNext,
  countEligible,
  DEFAULT_VISIBILITY_TIMEOUT_MS,
  DeadlineExceededError,
  deadlineSignal,
  markCompleted,
  markFailedOrRetry,
  markUnhandled,
  releaseClaim,
} from './claim.js';
export type { EnqueueOptions, EnqueueResult } from './enqueue.js';
export { enqueue, JobPayloadTooLargeError, wakeWorker } from './enqueue.js';
export type { JobHandler } from './handlers.js';
export { clearHandlers, getHandler, listHandlers, registerHandler } from './handlers.js';
