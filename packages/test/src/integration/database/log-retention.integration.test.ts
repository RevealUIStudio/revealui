/**
 * Integration tests for log retention cleanup (CR8-P3-02 PR1).
 *
 * Exercises `cleanupOldLogs()` end-to-end against a PGlite-backed Postgres.
 * Validates the retention window cutoff, dry-run counting, per-table
 * scoping, and env-var / override precedence.
 *
 * Module: packages/db/src/cleanup/log-retention.ts
 * Schemas: packages/db/src/schema/app-logs.ts, error-events.ts
 * Design: ~/suite/.jv/docs/cr8-p3-02-retention-design.md
 */

import { cleanupOldLogs } from '@revealui/db/cleanup';
import { appLogs, errorEvents } from '@revealui/db/schema';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../utils/drizzle-test-db.js';

describe('log retention cleanup (CR8-P3-02 PR1)', () => {
  let testDb: TestDb;
  // PgliteDatabase is runtime-compatible with the @revealui/db Database union.
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
    await testDb.pglite.exec('DELETE FROM app_logs');
    await testDb.pglite.exec('DELETE FROM error_events');
    delete process.env.REVEALUI_LOG_RETENTION_DAYS;
  });

  afterEach(() => {
    delete process.env.REVEALUI_LOG_RETENTION_DAYS;
  });

  it('deletes app_logs older than 90d, keeps newer rows', async () => {
    await testDb.drizzle.insert(appLogs).values([
      {
        id: 'old-1',
        timestamp: daysAgo(100),
        level: 'warn',
        message: 'old 1',
        app: 'api',
        environment: 'production',
      },
      {
        id: 'old-2',
        timestamp: daysAgo(91),
        level: 'error',
        message: 'old 2',
        app: 'admin',
        environment: 'production',
      },
      {
        id: 'fresh-1',
        timestamp: daysAgo(89),
        level: 'warn',
        message: 'fresh 1',
        app: 'api',
        environment: 'production',
      },
      {
        id: 'fresh-2',
        timestamp: daysAgo(1),
        level: 'error',
        message: 'fresh 2',
        app: 'marketing',
        environment: 'production',
      },
    ]);

    const result = await cleanupOldLogs(asDbOpts());

    expect(result.appLogs).toBe(2);
    expect(result.errorEvents).toBe(0);
    expect(result.dryRun).toBe(false);
    expect(result.retentionDays).toBe(90);

    const remaining = await testDb.pglite.query<{ id: string }>(
      'SELECT id FROM app_logs ORDER BY id',
    );
    expect(remaining.rows.map((r) => r.id)).toEqual(['fresh-1', 'fresh-2']);
  });

  it('deletes error_events older than 90d, keeps newer rows', async () => {
    await testDb.drizzle.insert(errorEvents).values([
      {
        id: 'err-old',
        timestamp: daysAgo(120),
        level: 'error',
        message: 'ancient error',
        app: 'api',
        environment: 'production',
      },
      {
        id: 'err-fresh',
        timestamp: daysAgo(30),
        level: 'fatal',
        message: 'recent error',
        app: 'admin',
        environment: 'production',
      },
    ]);

    const result = await cleanupOldLogs(asDbOpts());

    expect(result.errorEvents).toBe(1);
    expect(result.appLogs).toBe(0);

    const remaining = await testDb.pglite.query<{ id: string }>('SELECT id FROM error_events');
    expect(remaining.rows.map((r) => r.id)).toEqual(['err-fresh']);
  });

  it('dry-run counts without deleting', async () => {
    await testDb.drizzle.insert(appLogs).values([
      {
        id: 'old',
        timestamp: daysAgo(200),
        level: 'warn',
        message: 'old',
        app: 'api',
        environment: 'production',
      },
    ]);
    await testDb.drizzle.insert(errorEvents).values([
      {
        id: 'old-err',
        timestamp: daysAgo(200),
        level: 'error',
        message: 'old err',
        app: 'api',
        environment: 'production',
      },
    ]);

    const result = await cleanupOldLogs({ ...asDbOpts(), dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.appLogs).toBe(1);
    expect(result.errorEvents).toBe(1);

    const appRows = await testDb.pglite.query<{ id: string }>('SELECT id FROM app_logs');
    const errRows = await testDb.pglite.query<{ id: string }>('SELECT id FROM error_events');
    expect(appRows.rows).toHaveLength(1);
    expect(errRows.rows).toHaveLength(1);
  });

  it('honors retentionDays override', async () => {
    await testDb.drizzle.insert(appLogs).values([
      {
        id: 'a-10d',
        timestamp: daysAgo(10),
        level: 'warn',
        message: 'a',
        app: 'api',
        environment: 'production',
      },
      {
        id: 'a-3d',
        timestamp: daysAgo(3),
        level: 'warn',
        message: 'a',
        app: 'api',
        environment: 'production',
      },
    ]);

    const result = await cleanupOldLogs({ ...asDbOpts(), retentionDays: 7 });

    expect(result.retentionDays).toBe(7);
    expect(result.appLogs).toBe(1);

    const remaining = await testDb.pglite.query<{ id: string }>('SELECT id FROM app_logs');
    expect(remaining.rows.map((r) => r.id)).toEqual(['a-3d']);
  });

  it('honors REVEALUI_LOG_RETENTION_DAYS env var when override not provided', async () => {
    process.env.REVEALUI_LOG_RETENTION_DAYS = '30';

    await testDb.drizzle.insert(appLogs).values([
      {
        id: 'env-old',
        timestamp: daysAgo(45),
        level: 'warn',
        message: 'env-old',
        app: 'api',
        environment: 'production',
      },
      {
        id: 'env-fresh',
        timestamp: daysAgo(15),
        level: 'warn',
        message: 'env-fresh',
        app: 'api',
        environment: 'production',
      },
    ]);

    const result = await cleanupOldLogs(asDbOpts());

    expect(result.retentionDays).toBe(30);
    expect(result.appLogs).toBe(1);

    const remaining = await testDb.pglite.query<{ id: string }>('SELECT id FROM app_logs');
    expect(remaining.rows.map((r) => r.id)).toEqual(['env-fresh']);
  });

  it('scopes cleanup to requested tables only', async () => {
    await testDb.drizzle.insert(appLogs).values([
      {
        id: 'app-old',
        timestamp: daysAgo(100),
        level: 'warn',
        message: 'a',
        app: 'api',
        environment: 'production',
      },
    ]);
    await testDb.drizzle.insert(errorEvents).values([
      {
        id: 'err-old',
        timestamp: daysAgo(100),
        level: 'error',
        message: 'e',
        app: 'api',
        environment: 'production',
      },
    ]);

    const result = await cleanupOldLogs({ ...asDbOpts(), tables: ['appLogs'] });

    expect(result.appLogs).toBe(1);
    expect(result.errorEvents).toBe(0);

    const appRows = await testDb.pglite.query<{ id: string }>('SELECT id FROM app_logs');
    const errRows = await testDb.pglite.query<{ id: string }>('SELECT id FROM error_events');
    expect(appRows.rows).toHaveLength(0);
    expect(errRows.rows).toHaveLength(1);
  });

  it('rejects invalid retentionDays override', async () => {
    await expect(cleanupOldLogs({ ...asDbOpts(), retentionDays: 0 })).rejects.toThrow(
      'Must be a positive integer',
    );

    await expect(cleanupOldLogs({ ...asDbOpts(), retentionDays: -5 })).rejects.toThrow(
      'Must be a positive integer',
    );

    await expect(cleanupOldLogs({ ...asDbOpts(), retentionDays: 1.5 })).rejects.toThrow(
      'Must be a positive integer',
    );
  });

  it('falls back to 90d default when env var is absent or malformed', async () => {
    process.env.REVEALUI_LOG_RETENTION_DAYS = 'not-a-number';

    const result = await cleanupOldLogs(asDbOpts());
    expect(result.retentionDays).toBe(90);
  });
});
