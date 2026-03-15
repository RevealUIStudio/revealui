/**
 * Background Job Queue
 *
 * PostgreSQL-backed job queue using raw SQL for portability.
 * No external dependencies (no Redis, no pg-boss).
 *
 * Usage:
 *   import { createJobQueue } from '@revealui/core/jobs';
 *
 *   const queue = createJobQueue(dbExecutor);
 *   await queue.send('email.send', { to: 'user@example.com', subject: '...' });
 *   queue.work('email.send', async (job) => { await sendEmail(job.data); });
 */

export type {
  DatabaseExecutor,
  JobHandler,
  JobPayload,
  JobQueue,
  JobQueueConfig,
  SendOptions,
} from './queue.js';
export { createJobQueue } from './queue.js';
