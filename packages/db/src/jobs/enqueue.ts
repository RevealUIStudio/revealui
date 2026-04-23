/**
 * Producer API for the durable work queue (CR8-P2-01 phase A).
 *
 * Callers insert a row in the `jobs` table and immediately fire a wake
 * request to the worker. The wake is intentionally fire-and-forget — if the
 * fetch fails (network glitch, worker briefly unreachable, function cold
 * start), the cron safety-net (phase B) picks the job up on the next tick.
 *
 * @see packages/db/src/schema/jobs.ts — the underlying table
 * @see packages/db/src/jobs/claim.ts — consumer side (SKIP LOCKED dequeue)
 * @see apps/api/src/routes/jobs/run.ts — worker route (HTTP wake target)
 *
 * @example
 * ```typescript
 * const { jobId, deduplicated } = await enqueue('agent.dispatch', {
 *   ticketId: 'abc',
 *   prompt: '…',
 * }, {
 *   idempotencyKey: `agent.dispatch:${ticketId}`,
 *   retryLimit: 5,
 * });
 * ```
 */

import { randomUUID } from 'node:crypto';
import type { Database } from '../client/index.js';
import { getClient } from '../client/index.js';
import { jobs } from '../schema/jobs.js';

// Inline max payload size (1 MB) — keeps a huge payload from DoSing the
// queue at enqueue time. Matches design §14.
const MAX_PAYLOAD_BYTES = 1_048_576;

export class JobPayloadTooLargeError extends Error {
  readonly name = 'JobPayloadTooLargeError';
  readonly actualBytes: number;
  readonly maxBytes: number;

  constructor(actualBytes: number, maxBytes: number) {
    super(
      `[jobs] payload is ${actualBytes} bytes, exceeds limit of ${maxBytes} bytes; split the work or store the payload out-of-band and pass a reference`,
    );
    this.actualBytes = actualBytes;
    this.maxBytes = maxBytes;
  }
}

export interface EnqueueOptions {
  /** Delay before the job becomes eligible (milliseconds). Default: 0. */
  delayMs?: number;
  /** Max retries on failure. Default: 3. */
  retryLimit?: number;
  /** Higher = processed first. Default: 0. */
  priority?: number;
  /**
   * Unique key — inserts collide on this via PK so enqueue() is idempotent.
   * When omitted, a random UUID prevents all dedupe (every call gets a new
   * job). Prefer a natural key (e.g. the Stripe event id, the ticket id +
   * action) over a random one.
   */
  idempotencyKey?: string;
  /** Override base URL for wake fan-out. Primarily for tests. */
  baseUrlOverride?: string;
  /** Override wake secret for wake fan-out. Primarily for tests. */
  wakeSecretOverride?: string;
  /**
   * Skip the wake fan-out entirely (useful in tests + contexts where the
   * caller knows a worker invocation is about to happen anyway). The cron
   * safety-net still catches the job on its next tick.
   */
  skipWake?: boolean;
  /**
   * Override the Drizzle client used for the insert. Primarily for tests
   * that drive PGlite directly. Production callers rely on the default
   * getClient() singleton.
   */
  db?: Database;
}

export interface EnqueueResult {
  /** ID of the job row — stable across retries. */
  jobId: string;
  /**
   * True when the ON CONFLICT DO NOTHING branch hit, i.e. a row with this id
   * already existed. False when a new row was inserted.
   */
  deduplicated: boolean;
}

/**
 * Enqueue a job for asynchronous processing.
 *
 * Two paths to execution:
 *   1. The fan-out wake (fire-and-forget HTTP) pokes the worker
 *      immediately.
 *   2. If the wake is swallowed (network error, missing secret, …), the
 *      cron safety-net (phase B) reclaims the job on its next tick.
 */
export async function enqueue<TData extends Record<string, unknown>>(
  name: string,
  data: TData,
  options: EnqueueOptions = {},
): Promise<EnqueueResult> {
  // Payload-size guard — at the producer rather than the worker so callers
  // get a synchronous error and the queue stays clean.
  const serialized = JSON.stringify(data);
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    throw new JobPayloadTooLargeError(serialized.length, MAX_PAYLOAD_BYTES);
  }

  const db = options.db ?? getClient();
  const jobId = options.idempotencyKey ?? `${name}:${randomUUID()}`;
  const startAfter = new Date(Date.now() + (options.delayMs ?? 0));

  const inserted = await db
    .insert(jobs)
    .values({
      id: jobId,
      name,
      data,
      state: 'created',
      startAfter,
      retryLimit: options.retryLimit ?? 3,
      priority: options.priority ?? 0,
    })
    .onConflictDoNothing({ target: jobs.id })
    .returning();

  const deduplicated = inserted.length === 0;

  if (!(deduplicated || options.skipWake)) {
    // Fire-and-forget — never block the producer on wake latency, never
    // surface wake failures as enqueue failures.
    wakeWorker(jobId, options).catch(() => {
      // Swallow intentionally: the cron safety-net is the fallback.
    });
  }

  return { jobId, deduplicated };
}

/**
 * Fire a wake request to the worker. Exported so tests can assert on wake
 * behavior; production callers should use enqueue().
 *
 * Returns void regardless of wake outcome — errors are swallowed by enqueue
 * on purpose. Direct callers can .catch() if they want to observe failures.
 */
export async function wakeWorker(
  preferredJobId: string | null,
  options: Pick<EnqueueOptions, 'baseUrlOverride' | 'wakeSecretOverride'> = {},
): Promise<void> {
  const baseUrl =
    options.baseUrlOverride ?? process.env.REVEALUI_INTERNAL_BASE_URL ?? 'http://localhost:3004';
  const secret = options.wakeSecretOverride ?? process.env.REVEALUI_JOBS_WAKE_SECRET;

  // Missing secret is treated as "no worker configured yet"; the cron
  // safety-net will catch up once it ships.
  if (!secret) return;

  await fetch(`${baseUrl}/api/jobs/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Jobs-Wake-Secret': secret,
    },
    body: JSON.stringify({ preferredJobId }),
    keepalive: true,
  });
}
