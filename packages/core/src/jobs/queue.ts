/**
 * PostgreSQL-backed Job Queue
 *
 * Uses raw SQL via a database executor for portability.
 * Supports: delayed jobs, retries with exponential backoff, priorities, expiration.
 *
 * The jobs table must exist (see packages/db/src/schema/jobs.ts).
 */

// =============================================================================
// Types
// =============================================================================

/** Minimal database executor  -  accepts raw SQL strings */
export interface DatabaseExecutor {
  execute(query: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface JobQueueConfig {
  /** Polling interval in milliseconds (default: 5000) */
  pollingIntervalMs: number;
  /** Maximum concurrent jobs per worker (default: 5) */
  concurrency: number;
  /** Default retry limit for jobs without explicit limit (default: 3) */
  defaultRetryLimit: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  retryBackoffMs: number;
  /** Logger with error method */
  logger?: { error: (msg: string) => void };
}

const DEFAULT_CONFIG: JobQueueConfig = {
  pollingIntervalMs: 5000,
  concurrency: 5,
  defaultRetryLimit: 3,
  retryBackoffMs: 1000,
};

export interface SendOptions {
  /** Higher priority = processed first (default: 0) */
  priority?: number;
  /** Maximum retry attempts (default: config.defaultRetryLimit) */
  retryLimit?: number;
  /** Delay before first processing (Date or milliseconds from now) */
  startAfter?: Date | number;
  /** Job expires at this time (unprocessed jobs are skipped) */
  expireAt?: Date;
}

export interface JobPayload {
  id: string;
  name: string;
  data: Record<string, unknown>;
  retryCount: number;
}

export type JobHandler = (job: JobPayload) => Promise<void>;

export interface JobQueue {
  /** Enqueue a job for background processing */
  send(name: string, data: Record<string, unknown>, options?: SendOptions): Promise<string>;
  /** Register a handler for a job type and start polling */
  work(name: string, handler: JobHandler): void;
  /** Stop all polling workers */
  stop(): void;
  /** Get counts by state for monitoring */
  getQueueStats(): Promise<Record<string, number>>;
}

// =============================================================================
// Implementation
// =============================================================================

export function createJobQueue(
  executor: DatabaseExecutor,
  overrides?: Partial<JobQueueConfig>,
): JobQueue {
  const config = { ...DEFAULT_CONFIG, ...overrides };
  const timers: ReturnType<typeof setInterval>[] = [];
  const activeJobs = new Set<string>();
  let stopped = false;

  async function send(
    name: string,
    data: Record<string, unknown>,
    options?: SendOptions,
  ): Promise<string> {
    const id = crypto.randomUUID();
    let startAfter = new Date();
    if (options?.startAfter instanceof Date) {
      startAfter = options.startAfter;
    } else if (typeof options?.startAfter === 'number') {
      startAfter = new Date(Date.now() + options.startAfter);
    }

    await executor.execute(
      `INSERT INTO jobs (id, name, data, state, priority, retry_limit, start_after, expire_at, created_at)
       VALUES ($1, $2, $3, 'created', $4, $5, $6, $7, NOW())`,
      [
        id,
        name,
        JSON.stringify(data),
        options?.priority ?? 0,
        options?.retryLimit ?? config.defaultRetryLimit,
        startAfter.toISOString(),
        options?.expireAt?.toISOString() ?? null,
      ],
    );

    return id;
  }

  /**
   * Atomically claim the next available job using FOR UPDATE SKIP LOCKED.
   */
  async function fetchNextJob(name: string): Promise<JobPayload | null> {
    const result = await executor.execute(
      `UPDATE jobs
       SET state = 'active', started_at = NOW()
       WHERE id = (
         SELECT id FROM jobs
         WHERE name = $1
           AND state IN ('created', 'retry')
           AND start_after <= NOW()
           AND (expire_at IS NULL OR expire_at > NOW())
         ORDER BY priority DESC, created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, name, data, retry_count`,
      [name],
    );

    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id as string,
      name: row.name as string,
      data: (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) as Record<
        string,
        unknown
      >,
      retryCount: (row.retry_count as number) ?? 0,
    };
  }

  async function completeJob(id: string): Promise<void> {
    await executor.execute(
      `UPDATE jobs SET state = 'completed', completed_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async function failJob(
    id: string,
    retryCount: number,
    retryLimit: number,
    error: string,
  ): Promise<void> {
    if (retryCount + 1 < retryLimit) {
      const delay = config.retryBackoffMs * 2 ** retryCount;
      const nextRetry = new Date(Date.now() + delay);
      await executor.execute(
        `UPDATE jobs SET state = 'retry', retry_count = $1, start_after = $2, output = $3 WHERE id = $4`,
        [retryCount + 1, nextRetry.toISOString(), JSON.stringify({ error }), id],
      );
    } else {
      await executor.execute(
        `UPDATE jobs SET state = 'failed', retry_count = $1, completed_at = NOW(), output = $2 WHERE id = $3`,
        [retryCount + 1, JSON.stringify({ error }), id],
      );
    }
  }

  async function poll(name: string, handler: JobHandler): Promise<void> {
    if (stopped) return;
    if (activeJobs.size >= config.concurrency) return;

    try {
      const job = await fetchNextJob(name);
      if (!job) return;

      activeJobs.add(job.id);
      try {
        await handler(job);
        await completeJob(job.id);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        config.logger?.error(`Job ${name}/${job.id} failed: ${errorMsg}`);
        await failJob(job.id, job.retryCount, config.defaultRetryLimit, errorMsg);
      } finally {
        activeJobs.delete(job.id);
      }
    } catch (err) {
      config.logger?.error(
        `Job queue poll error for ${name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  function work(name: string, handler: JobHandler): void {
    const timer = setInterval(() => {
      void poll(name, handler);
    }, config.pollingIntervalMs);
    timers.push(timer);
    void poll(name, handler);
  }

  function stop(): void {
    stopped = true;
    for (const timer of timers) {
      clearInterval(timer);
    }
    timers.length = 0;
  }

  async function getQueueStats(): Promise<Record<string, number>> {
    const result = await executor.execute(
      `SELECT state, count(*)::int as count FROM jobs GROUP BY state`,
    );
    const stats: Record<string, number> = {};
    for (const row of result.rows) {
      stats[row.state as string] = row.count as number;
    }
    return stats;
  }

  return { send, work, stop, getQueueStats };
}
