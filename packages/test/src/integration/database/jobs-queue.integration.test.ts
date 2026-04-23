/**
 * Integration tests for the durable work queue primitive (CR8-P2-01 phase A).
 *
 * Exercises the producer → claim → complete/retry cycle end-to-end against
 * a PGlite-backed Postgres. Skips the HTTP worker route (thin wrapper) and
 * drives claim() + handlers directly from the test.
 *
 * Migration: packages/db/migrations/0008_jobs_visibility_timeout.sql
 * Producer/claim modules: packages/db/src/jobs/
 * Worker route (not tested here): apps/api/src/routes/jobs/run.ts
 *
 * Uses the `{ db }` override on each primitive to inject PGlite's Drizzle
 * client instead of the singleton getClient(). See drizzle-test-db.ts for
 * the PGlite wiring. Identity casts (`as never`) are required because
 * PgliteDatabase isn't part of the @revealui/db Database union; runtime
 * shapes are compatible.
 */

import {
  claimNext,
  clearHandlers,
  countEligible,
  enqueue,
  getHandler,
  markCompleted,
  markFailedOrRetry,
  registerHandler,
} from '@revealui/db/jobs';
import { jobs } from '@revealui/db/schema';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../utils/drizzle-test-db.js';

describe('durable work queue primitive (CR8-P2-01 phase A)', () => {
  let testDb: TestDb;
  // Cast once: PgliteDatabase shape is runtime-compatible with Database.
  // The `{ db }` override accepts the union type; PGlite isn't a member but
  // .insert/.update/.select/.execute all work identically.
  const asDbOpts = (): { db: never } => ({ db: testDb.drizzle as never });

  beforeAll(async () => {
    testDb = await createTestDb();
  }, 30_000);

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    await testDb.pglite.exec('DELETE FROM jobs');
    clearHandlers();
  });

  afterEach(() => {
    clearHandlers();
  });

  it('applies migration 0008 — locked_by / locked_until / last_error columns + partial index exist', async () => {
    const columns = await testDb.pglite.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'jobs' AND column_name IN ('locked_by', 'locked_until', 'last_error')
         ORDER BY column_name`,
    );
    const names = columns.rows.map((r) => r.column_name).sort();
    expect(names).toEqual(['last_error', 'locked_by', 'locked_until']);

    const indexes = await testDb.pglite.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'jobs' AND indexname = 'jobs_locked_until_idx'`,
    );
    expect(indexes.rows).toHaveLength(1);
    // Partial-index predicate is preserved: "WHERE state = 'active'" (or the
    // equivalent parenthesised form Postgres may choose).
    expect(indexes.rows[0]?.indexdef).toMatch(/WHERE .*state.*active/i);
  });

  it('runs a full enqueue → claim → complete cycle', async () => {
    const calls: Array<{ data: unknown; jobId: string }> = [];
    registerHandler<{ x: number }, { doubled: number }>('test.double', async (data, job) => {
      calls.push({ data, jobId: job.id });
      return { doubled: data.x * 2 };
    });

    // 1. Enqueue with skipWake — the integration test drives the worker loop
    //    manually, no HTTP involved.
    const { jobId, deduplicated } = await enqueue(
      'test.double',
      { x: 21 },
      { idempotencyKey: 'double-21', skipWake: true, db: testDb.drizzle as never },
    );
    expect(jobId).toBe('double-21');
    expect(deduplicated).toBe(false);

    // 2. Eligible count reflects the insert.
    expect(await countEligible(asDbOpts())).toBe(1);

    // 3. Claim the job — row transitions to state='active' with a lock.
    const claim = await claimNext({ workerId: 'worker-1', ...asDbOpts() });
    expect(claim).not.toBeNull();
    expect(claim?.id).toBe('double-21');
    expect(claim?.state).toBe('active');
    expect(claim?.lockedBy).toBe('worker-1');
    expect(claim?.lockedUntil).toBeInstanceOf(Date);
    expect(claim?.startedAt).toBeInstanceOf(Date);

    // 4. Dispatch through the handler registry.
    const handler = getHandler(claim?.name ?? '');
    expect(handler).toBeDefined();
    const output = await handler?.(claim?.data ?? {}, claim!);
    expect(output).toEqual({ doubled: 42 });
    expect(calls).toEqual([{ data: { x: 21 }, jobId: 'double-21' }]);

    // 5. Mark completed.
    await markCompleted(jobId, output as Record<string, unknown>, asDbOpts());

    // 6. The row is now completed, lock fields cleared, eligible count=0.
    const rows = await testDb.drizzle.select().from(jobs);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.state).toBe('completed');
    expect(row.output).toEqual({ doubled: 42 });
    expect(row.lockedBy).toBeNull();
    expect(row.lockedUntil).toBeNull();
    expect(row.completedAt).toBeInstanceOf(Date);

    expect(await countEligible(asDbOpts())).toBe(0);

    // 7. Subsequent claim returns null — queue is drained.
    expect(await claimNext(asDbOpts())).toBeNull();
  });

  it('dedupes on idempotencyKey and does not fire a second wake', async () => {
    const first = await enqueue(
      'test.job',
      { foo: 'bar' },
      { idempotencyKey: 'dedupe-me', skipWake: true, db: testDb.drizzle as never },
    );
    const second = await enqueue(
      'test.job',
      { foo: 'bar' },
      { idempotencyKey: 'dedupe-me', skipWake: true, db: testDb.drizzle as never },
    );

    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(second.jobId).toBe('dedupe-me');

    const rows = await testDb.drizzle.select().from(jobs);
    expect(rows).toHaveLength(1);
  });

  it('retries on handler failure, then lands in failed after retry limit', async () => {
    let attempts = 0;
    registerHandler('test.flaky', async () => {
      attempts += 1;
      throw new Error(`boom-${attempts}`);
    });

    await enqueue(
      'test.flaky',
      { n: 1 },
      { idempotencyKey: 'flaky-1', retryLimit: 2, skipWake: true, db: testDb.drizzle as never },
    );

    // --- First attempt: claim, throw, markFailedOrRetry → state='created'
    //     with future start_after.
    const claim1 = await claimNext(asDbOpts());
    expect(claim1?.id).toBe('flaky-1');
    const handler = getHandler('test.flaky');
    expect(handler).toBeDefined();

    let decision1Kind: 'retry' | 'failed' | undefined;
    try {
      await handler?.(claim1?.data ?? {}, claim1!);
    } catch (err) {
      const decision = await markFailedOrRetry(claim1?.id ?? '', err, Date.now(), asDbOpts());
      decision1Kind = decision.kind;
      expect(decision.kind).toBe('retry');
      expect(decision.retryCount).toBe(1);
      expect(decision.error).toBe('boom-1');
    }
    expect(decision1Kind).toBe('retry');

    const afterFirst = (await testDb.drizzle.select().from(jobs))[0]!;
    expect(afterFirst.state).toBe('created');
    expect(afterFirst.retryCount).toBe(1);
    expect(afterFirst.lastError).toBe('boom-1');
    expect(afterFirst.startAfter.getTime()).toBeGreaterThan(Date.now());
    expect(afterFirst.lockedBy).toBeNull();

    // --- Force start_after into the past so the next claim sees it eligible.
    await testDb.pglite.query(`UPDATE jobs SET start_after = now() - interval '1 second'`);

    // --- Second attempt: claim, throw, retryCount+1 = 2 === retryLimit → failed.
    const claim2 = await claimNext(asDbOpts());
    expect(claim2?.id).toBe('flaky-1');
    expect(claim2?.retryCount).toBe(1);

    let decision2Kind: 'retry' | 'failed' | undefined;
    try {
      await handler?.(claim2?.data ?? {}, claim2!);
    } catch (err) {
      const decision = await markFailedOrRetry(claim2?.id ?? '', err, Date.now(), asDbOpts());
      decision2Kind = decision.kind;
      expect(decision.kind).toBe('failed');
      expect(decision.retryCount).toBe(2);
      expect(decision.error).toBe('boom-2');
    }
    expect(decision2Kind).toBe('failed');

    const afterSecond = (await testDb.drizzle.select().from(jobs))[0]!;
    expect(afterSecond.state).toBe('failed');
    expect(afterSecond.retryCount).toBe(2);
    expect(afterSecond.lastError).toBe('boom-2');
    expect(afterSecond.completedAt).toBeInstanceOf(Date);
    expect(afterSecond.lockedBy).toBeNull();
  });

  it('higher priority jobs claim before lower priority', async () => {
    await enqueue(
      'test.lo',
      { p: 'lo' },
      { idempotencyKey: 'lo', priority: 0, skipWake: true, db: testDb.drizzle as never },
    );
    await enqueue(
      'test.hi',
      { p: 'hi' },
      { idempotencyKey: 'hi', priority: 10, skipWake: true, db: testDb.drizzle as never },
    );

    const first = await claimNext(asDbOpts());
    const second = await claimNext(asDbOpts());

    expect(first?.id).toBe('hi');
    expect(second?.id).toBe('lo');
  });

  it('does not claim jobs whose start_after is still in the future', async () => {
    await enqueue(
      'test.delayed',
      { q: 1 },
      {
        idempotencyKey: 'delayed-1',
        delayMs: 60_000,
        skipWake: true,
        db: testDb.drizzle as never,
      },
    );
    expect(await claimNext(asDbOpts())).toBeNull();
    expect(await countEligible(asDbOpts())).toBe(0);
  });
});
