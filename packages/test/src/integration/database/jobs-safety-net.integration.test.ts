/**
 * Integration tests for the queue cron safety-net (CR8-P2-01 phase B).
 *
 * Exercises reclaimStalled() end-to-end against PGlite. The cron route
 * itself (apps/api/src/routes/cron/jobs-safety-net.ts) is a thin wrapper
 * over this primitive + countEligible + wakeWorker — it's covered by
 * the existing cleanup.ts route pattern and doesn't need its own
 * integration test beyond asserting the DB-layer behavior here.
 */

import { claimNext, enqueue, reclaimStalled } from '@revealui/db/jobs';
import { jobs } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../utils/drizzle-test-db.js';

describe('queue cron safety-net (CR8-P2-01 phase B)', () => {
  let testDb: TestDb;
  const asDbOpts = (): { db: never } => ({ db: testDb.drizzle as never });

  beforeAll(async () => {
    testDb = await createTestDb();
  }, 30_000);

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    await testDb.pglite.exec('DELETE FROM jobs');
  });

  it('reclaims rows whose visibility timeout has expired', async () => {
    // 1. Enqueue + claim a row to put it in state='active' with a lock.
    await enqueue(
      'test.stall',
      { foo: 1 },
      { idempotencyKey: 'stalled-1', skipWake: true, db: testDb.drizzle as never },
    );
    const claim = await claimNext({ workerId: 'crashed-worker', ...asDbOpts() });
    expect(claim).not.toBeNull();
    expect(claim?.state).toBe('active');

    // 2. Fake a stall: move locked_until into the past.
    await testDb.pglite.query(
      `UPDATE jobs SET locked_until = now() - interval '5 minutes' WHERE id = $1`,
      ['stalled-1'],
    );

    // 3. Safety-net reclaims the row.
    const reclaimed = await reclaimStalled(asDbOpts());
    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0]).toMatchObject({
      id: 'stalled-1',
      name: 'test.stall',
      retryCount: 1, // was 0; reclaim bumps +1
      previousLockedBy: 'crashed-worker',
    });
    expect(reclaimed[0]?.previousLockedUntil).toBeInstanceOf(Date);

    // 4. Row is re-eligible — next claim picks it up.
    const row = (await testDb.drizzle.select().from(jobs).where(eq(jobs.id, 'stalled-1')))[0]!;
    expect(row.state).toBe('created');
    expect(row.retryCount).toBe(1);
    expect(row.lastError).toBe('stalled: claim expired before completion');
    expect(row.lockedBy).toBeNull();
    expect(row.lockedUntil).toBeNull();

    // 5. A second reclaim call is a no-op (idempotent).
    const secondReclaim = await reclaimStalled(asDbOpts());
    expect(secondReclaim).toEqual([]);
  });

  it('does not reclaim claims still within their visibility window', async () => {
    await enqueue(
      'test.live',
      { foo: 1 },
      { idempotencyKey: 'live-1', skipWake: true, db: testDb.drizzle as never },
    );
    // Claim with the default 60s visibility timeout — not stalled.
    const claim = await claimNext({ workerId: 'live-worker', ...asDbOpts() });
    expect(claim?.state).toBe('active');

    const reclaimed = await reclaimStalled(asDbOpts());
    expect(reclaimed).toEqual([]);

    // Row untouched.
    const row = (await testDb.drizzle.select().from(jobs).where(eq(jobs.id, 'live-1')))[0]!;
    expect(row.state).toBe('active');
    expect(row.lockedBy).toBe('live-worker');
    expect(row.retryCount).toBe(0);
  });

  it('does not touch rows in terminal states (completed / failed)', async () => {
    // Two rows, neither active-with-expired-lock.
    await enqueue(
      'test.done',
      {},
      { idempotencyKey: 'done-1', skipWake: true, db: testDb.drizzle as never },
    );
    await enqueue(
      'test.done',
      {},
      { idempotencyKey: 'done-2', skipWake: true, db: testDb.drizzle as never },
    );
    await testDb.pglite.query(
      `UPDATE jobs SET state = 'completed', completed_at = now() WHERE id = 'done-1'`,
    );
    await testDb.pglite.query(
      `UPDATE jobs SET state = 'failed', completed_at = now(), last_error = 'prior' WHERE id = 'done-2'`,
    );

    const reclaimed = await reclaimStalled(asDbOpts());
    expect(reclaimed).toEqual([]);

    const rows = await testDb.drizzle.select().from(jobs);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId['done-1']?.state).toBe('completed');
    expect(byId['done-2']?.state).toBe('failed');
    expect(byId['done-2']?.lastError).toBe('prior');
  });

  it('handles multiple stalled rows in a single pass', async () => {
    for (const id of ['stall-a', 'stall-b', 'stall-c']) {
      await enqueue(
        'test.stall',
        { id },
        { idempotencyKey: id, skipWake: true, db: testDb.drizzle as never },
      );
      await claimNext({ workerId: `worker-${id}`, ...asDbOpts() });
    }
    // Mark all three stalled.
    await testDb.pglite.query(
      `UPDATE jobs SET locked_until = now() - interval '1 minute' WHERE state = 'active'`,
    );

    const reclaimed = await reclaimStalled(asDbOpts());
    expect(reclaimed).toHaveLength(3);
    const ids = reclaimed.map((r) => r.id).sort();
    expect(ids).toEqual(['stall-a', 'stall-b', 'stall-c']);

    const afterRows = await testDb.drizzle.select().from(jobs);
    for (const row of afterRows) {
      expect(row.state).toBe('created');
      expect(row.retryCount).toBe(1);
      expect(row.lockedBy).toBeNull();
      expect(row.lastError).toBe('stalled: claim expired before completion');
    }
  });
});
