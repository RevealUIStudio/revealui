/**
 * Integration tests for operational-hygiene retention (CR8-P3-02 PR2).
 *
 * Exercises `cleanupOperational()` end-to-end against a PGlite-backed
 * Postgres. Validates the per-table cutoffs, state safety rules, dry-run
 * counting, per-table scoping, and env-var / override precedence.
 *
 * NOTE: unreconciledWebhooks coverage deferred — table has a schema
 * definition but no migration (see module-level doc comment and the
 * follow-up task "Fix missing unreconciled_webhooks migration").
 *
 * Module: packages/db/src/cleanup/operational-retention.ts
 * Schemas: packages/db/src/schema/{jobs,webhook-events}.ts
 * Design: ~/suite/.jv/docs/cr8-p3-02-retention-design.md
 */

import { cleanupOperational } from '@revealui/db/cleanup';
import { jobs, processedWebhookEvents, unreconciledWebhooks } from '@revealui/db/schema';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../utils/drizzle-test-db.js';

describe('operational-hygiene retention (CR8-P3-02 PR2)', () => {
  let testDb: TestDb;
  const asDbOpts = (): { db: never } => ({ db: testDb.drizzle as never });

  const daysAgo = (n: number): Date => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d;
  };

  beforeAll(async () => {
    testDb = await createTestDb();
  }, 30_000);

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    await testDb.pglite.exec('DELETE FROM jobs');
    await testDb.pglite.exec('DELETE FROM processed_webhook_events');
    await testDb.pglite.exec('DELETE FROM unreconciled_webhooks');
    delete process.env.REVEALUI_JOB_RETENTION_DAYS;
    delete process.env.REVEALUI_WEBHOOK_EVENT_RETENTION_DAYS;
    delete process.env.REVEALUI_WEBHOOK_RECONCILIATION_RETENTION_DAYS;
  });

  afterEach(() => {
    delete process.env.REVEALUI_JOB_RETENTION_DAYS;
    delete process.env.REVEALUI_WEBHOOK_EVENT_RETENTION_DAYS;
    delete process.env.REVEALUI_WEBHOOK_RECONCILIATION_RETENTION_DAYS;
  });

  describe('jobs', () => {
    it('deletes completed + failed jobs past 30d, keeps fresh terminal rows', async () => {
      await testDb.drizzle.insert(jobs).values([
        {
          id: 'old-completed',
          name: 'email.send',
          data: {},
          state: 'completed',
          createdAt: daysAgo(60),
          completedAt: daysAgo(40),
        },
        {
          id: 'old-failed',
          name: 'email.send',
          data: {},
          state: 'failed',
          createdAt: daysAgo(60),
          completedAt: daysAgo(35),
        },
        {
          id: 'fresh-completed',
          name: 'email.send',
          data: {},
          state: 'completed',
          createdAt: daysAgo(10),
          completedAt: daysAgo(5),
        },
      ]);

      const result = await cleanupOperational(asDbOpts());

      expect(result.jobs).toBe(2);
      expect(result.windows.jobs).toBe(30);

      const remaining = await testDb.pglite.query<{ id: string }>(
        'SELECT id FROM jobs ORDER BY id',
      );
      expect(remaining.rows.map((r) => r.id)).toEqual(['fresh-completed']);
    });

    it('NEVER purges active, created, or retry jobs regardless of age', async () => {
      await testDb.drizzle.insert(jobs).values([
        {
          id: 'ancient-active',
          name: 'long.running',
          data: {},
          state: 'active',
          createdAt: daysAgo(365),
          completedAt: null,
        },
        {
          id: 'ancient-created',
          name: 'pending.forever',
          data: {},
          state: 'created',
          createdAt: daysAgo(365),
          completedAt: null,
        },
        {
          id: 'ancient-retry',
          name: 'legacy.retry',
          data: {},
          state: 'retry',
          createdAt: daysAgo(365),
          completedAt: null,
        },
      ]);

      const result = await cleanupOperational(asDbOpts());

      expect(result.jobs).toBe(0);

      const remaining = await testDb.pglite.query<{ id: string }>(
        'SELECT id FROM jobs ORDER BY id',
      );
      expect(remaining.rows).toHaveLength(3);
    });

    it('uses completedAt (not createdAt) as the cutoff column', async () => {
      // Long-running job created 60d ago but just completed — should survive.
      await testDb.drizzle.insert(jobs).values([
        {
          id: 'long-running-just-completed',
          name: 'slow.job',
          data: {},
          state: 'completed',
          createdAt: daysAgo(60),
          completedAt: daysAgo(1),
        },
      ]);

      const result = await cleanupOperational(asDbOpts());

      expect(result.jobs).toBe(0);
      const remaining = await testDb.pglite.query<{ id: string }>('SELECT id FROM jobs');
      expect(remaining.rows.map((r) => r.id)).toEqual(['long-running-just-completed']);
    });

    it('ignores terminal rows with null completedAt (defensive)', async () => {
      // Shouldn't happen in practice but guard against it.
      await testDb.drizzle.insert(jobs).values([
        {
          id: 'malformed-terminal',
          name: 'oddity',
          data: {},
          state: 'completed',
          createdAt: daysAgo(365),
          completedAt: null,
        },
      ]);

      const result = await cleanupOperational(asDbOpts());
      expect(result.jobs).toBe(0);
    });
  });

  describe('processed_webhook_events', () => {
    it('deletes events past 90d, keeps recent rows', async () => {
      await testDb.drizzle.insert(processedWebhookEvents).values([
        {
          id: 'evt_old',
          eventType: 'checkout.session.completed',
          processedAt: daysAgo(100),
        },
        {
          id: 'evt_fresh',
          eventType: 'invoice.paid',
          processedAt: daysAgo(30),
        },
      ]);

      const result = await cleanupOperational(asDbOpts());

      expect(result.webhookEvents).toBe(1);
      expect(result.windows.webhookEvents).toBe(90);

      const remaining = await testDb.pglite.query<{ id: string }>(
        'SELECT id FROM processed_webhook_events',
      );
      expect(remaining.rows.map((r) => r.id)).toEqual(['evt_fresh']);
    });
  });

  describe('unreconciled_webhooks', () => {
    it('deletes RESOLVED rows past 90d, keeps unresolved rows forever', async () => {
      await testDb.drizzle.insert(unreconciledWebhooks).values([
        {
          eventId: 'evt_old_resolved',
          eventType: 'checkout.session.completed',
          errorTrace: 'stripe timeout',
          createdAt: daysAgo(200),
          resolvedAt: daysAgo(100),
          resolvedBy: 'cron',
        },
        {
          eventId: 'evt_ancient_unresolved',
          eventType: 'invoice.payment_failed',
          errorTrace: 'customer unreachable',
          createdAt: daysAgo(365),
          resolvedAt: null,
          resolvedBy: null,
        },
        {
          eventId: 'evt_fresh_resolved',
          eventType: 'customer.subscription.updated',
          errorTrace: 'race condition',
          createdAt: daysAgo(30),
          resolvedAt: daysAgo(10),
          resolvedBy: 'admin@revealui.com',
        },
      ]);

      const result = await cleanupOperational(asDbOpts());

      expect(result.unreconciledWebhooks).toBe(1);
      expect(result.windows.unreconciledWebhooks).toBe(90);

      const remaining = await testDb.pglite.query<{ event_id: string }>(
        'SELECT event_id FROM unreconciled_webhooks ORDER BY event_id',
      );
      // ancient-unresolved MUST survive; fresh-resolved survives by window.
      expect(remaining.rows.map((r) => r.event_id)).toEqual([
        'evt_ancient_unresolved',
        'evt_fresh_resolved',
      ]);
    });

    it('NEVER purges unresolved rows regardless of age (safety)', async () => {
      await testDb.drizzle.insert(unreconciledWebhooks).values([
        {
          eventId: 'evt_eternal_bug',
          eventType: 'checkout.session.completed',
          errorTrace: 'unhandled payment',
          createdAt: daysAgo(10_000),
          resolvedAt: null,
          resolvedBy: null,
        },
      ]);

      const result = await cleanupOperational(asDbOpts());
      expect(result.unreconciledWebhooks).toBe(0);

      const remaining = await testDb.pglite.query<{ event_id: string }>(
        'SELECT event_id FROM unreconciled_webhooks',
      );
      expect(remaining.rows).toHaveLength(1);
    });
  });

  describe('options + env vars', () => {
    it('dry-run counts without deleting across both tables', async () => {
      await testDb.drizzle.insert(jobs).values([
        {
          id: 'j',
          name: 'x',
          data: {},
          state: 'completed',
          createdAt: daysAgo(60),
          completedAt: daysAgo(40),
        },
      ]);
      await testDb.drizzle
        .insert(processedWebhookEvents)
        .values([{ id: 'evt', eventType: 'x', processedAt: daysAgo(100) }]);

      const result = await cleanupOperational({ ...asDbOpts(), dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.jobs).toBe(1);
      expect(result.webhookEvents).toBe(1);

      const jobsRows = await testDb.pglite.query<{ id: string }>('SELECT id FROM jobs');
      const evtRows = await testDb.pglite.query<{ id: string }>(
        'SELECT id FROM processed_webhook_events',
      );
      expect(jobsRows.rows).toHaveLength(1);
      expect(evtRows.rows).toHaveLength(1);
    });

    it('honors per-table retentionDays overrides', async () => {
      await testDb.drizzle.insert(jobs).values([
        {
          id: 'j',
          name: 'x',
          data: {},
          state: 'completed',
          createdAt: daysAgo(20),
          completedAt: daysAgo(10),
        },
      ]);

      const result = await cleanupOperational({
        ...asDbOpts(),
        retentionDays: { jobs: 7 },
      });

      expect(result.windows.jobs).toBe(7);
      expect(result.windows.webhookEvents).toBe(90);
      expect(result.jobs).toBe(1);
    });

    it('honors REVEALUI_* env vars', async () => {
      process.env.REVEALUI_JOB_RETENTION_DAYS = '60';
      process.env.REVEALUI_WEBHOOK_EVENT_RETENTION_DAYS = '14';

      const result = await cleanupOperational(asDbOpts());

      expect(result.windows.jobs).toBe(60);
      expect(result.windows.webhookEvents).toBe(14);
    });

    it('scopes cleanup to requested tables only', async () => {
      await testDb.drizzle.insert(jobs).values([
        {
          id: 'j',
          name: 'x',
          data: {},
          state: 'completed',
          createdAt: daysAgo(60),
          completedAt: daysAgo(40),
        },
      ]);
      await testDb.drizzle
        .insert(processedWebhookEvents)
        .values([{ id: 'evt', eventType: 'x', processedAt: daysAgo(100) }]);

      const result = await cleanupOperational({
        ...asDbOpts(),
        tables: ['webhookEvents'],
      });

      expect(result.webhookEvents).toBe(1);
      expect(result.jobs).toBe(0); // scoped out

      const jobsRows = await testDb.pglite.query<{ id: string }>('SELECT id FROM jobs');
      expect(jobsRows.rows).toHaveLength(1);
    });

    it('rejects invalid retentionDays override', async () => {
      await expect(
        cleanupOperational({ ...asDbOpts(), retentionDays: { jobs: 0 } }),
      ).rejects.toThrow('Must be a positive integer');

      await expect(
        cleanupOperational({ ...asDbOpts(), retentionDays: { webhookEvents: -5 } }),
      ).rejects.toThrow('Must be a positive integer');

      await expect(
        cleanupOperational({ ...asDbOpts(), retentionDays: { jobs: 1.5 } }),
      ).rejects.toThrow('Must be a positive integer');
    });
  });
});
