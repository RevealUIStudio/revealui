/**
 * Integration tests for `GET /api/mcp/usage` (A.3). Uses PGlite end-to-end
 * so the percentile_disc aggregation is exercised against real Postgres
 * semantics.
 */

import { accounts, usageMeters } from '@revealui/db/schema';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';
import mcpUsageRoute from '../mcp-usage.js';

let testDb: TestDb;

vi.mock('@revealui/db', async () => {
  const actual = await vi.importActual<typeof import('@revealui/db')>('@revealui/db');
  return { ...actual, getClient: () => testDb.drizzle };
});

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const ACCOUNT_A = 'acct_test_a';
const ACCOUNT_B = 'acct_test_b';

interface MountOptions {
  user?: { id: string; role: string };
  entitlements?: { accountId: string | null };
}

function mountApp(opts: MountOptions): Hono {
  const app = new Hono<{
    Variables: {
      user?: { id: string; role: string };
      entitlements?: { accountId: string | null };
    };
  }>();
  app.use('*', async (c, next) => {
    if (opts.user) c.set('user', opts.user);
    if (opts.entitlements) c.set('entitlements', opts.entitlements);
    await next();
  });
  app.route('/api/mcp/usage', mcpUsageRoute);
  return app;
}

async function seedAccount(id: string): Promise<void> {
  await testDb.drizzle.insert(accounts).values({
    id,
    name: `Test ${id}`,
    slug: id,
    status: 'active',
  });
}

async function seedRow(opts: {
  accountId: string;
  meterName: string;
  durationMs?: number | null;
  errored?: boolean | null;
  periodStart?: Date;
  idempotencyKey?: string;
}): Promise<void> {
  await testDb.drizzle.insert(usageMeters).values({
    id: crypto.randomUUID(),
    accountId: opts.accountId,
    meterName: opts.meterName,
    quantity: 1,
    periodStart: opts.periodStart ?? new Date(),
    periodEnd: null,
    source: 'agent',
    idempotencyKey: opts.idempotencyKey ?? crypto.randomUUID(),
    durationMs: opts.durationMs ?? null,
    errored: opts.errored ?? null,
  });
}

beforeEach(async () => {
  testDb = await createTestDb();
});

afterEach(async () => {
  await testDb.close();
});

describe('GET /api/mcp/usage', () => {
  it('returns 401 when caller is unauthenticated', async () => {
    const app = mountApp({});
    const res = await app.request('/api/mcp/usage', {
      headers: { Accept: 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 409 when caller has no resolvable accountId', async () => {
    const app = mountApp({
      user: { id: 'user-x', role: 'admin' },
      entitlements: { accountId: null },
    });
    const res = await app.request('/api/mcp/usage');
    expect(res.status).toBe(409);
  });

  it('returns empty meters array when no rows in window', async () => {
    await seedAccount(ACCOUNT_A);
    const app = mountApp({
      user: { id: 'user-1', role: 'admin' },
      entitlements: { accountId: ACCOUNT_A },
    });
    const res = await app.request('/api/mcp/usage?range=24h');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { meters: unknown[]; range: string; accountId: string };
    expect(body.meters).toEqual([]);
    expect(body.range).toBe('24h');
    expect(body.accountId).toBe(ACCOUNT_A);
  });

  it('aggregates total / success / error counts per meterName', async () => {
    await seedAccount(ACCOUNT_A);
    // 3 successes, 2 errors, 1 unknown (NULL errored) for tool.call
    for (let i = 0; i < 3; i++) {
      await seedRow({ accountId: ACCOUNT_A, meterName: 'mcp.tool.call', errored: false });
    }
    for (let i = 0; i < 2; i++) {
      await seedRow({ accountId: ACCOUNT_A, meterName: 'mcp.tool.call', errored: true });
    }
    await seedRow({ accountId: ACCOUNT_A, meterName: 'mcp.tool.call', errored: null });
    // 1 success for sampling
    await seedRow({
      accountId: ACCOUNT_A,
      meterName: 'mcp.sampling.create',
      errored: false,
    });

    const app = mountApp({
      user: { id: 'user-1', role: 'admin' },
      entitlements: { accountId: ACCOUNT_A },
    });
    const res = await app.request('/api/mcp/usage?range=24h');
    const body = (await res.json()) as {
      meters: Array<{
        meterName: string;
        total: number;
        successCount: number;
        errorCount: number;
        unknownCount: number;
      }>;
    };
    expect(body.meters).toHaveLength(2);
    const tool = body.meters.find((m) => m.meterName === 'mcp.tool.call');
    expect(tool).toMatchObject({
      total: 6,
      successCount: 3,
      errorCount: 2,
      unknownCount: 1,
    });
    const sampling = body.meters.find((m) => m.meterName === 'mcp.sampling.create');
    expect(sampling).toMatchObject({
      total: 1,
      successCount: 1,
      errorCount: 0,
      unknownCount: 0,
    });
  });

  it('computes p50 / p95 from non-null duration_ms values', async () => {
    await seedAccount(ACCOUNT_A);
    // 10 rows with durations 10, 20, 30, ..., 100. Plus 2 NULL rows that
    // should be excluded.
    for (let i = 1; i <= 10; i++) {
      await seedRow({
        accountId: ACCOUNT_A,
        meterName: 'mcp.tool.call',
        errored: false,
        durationMs: i * 10,
      });
    }
    await seedRow({ accountId: ACCOUNT_A, meterName: 'mcp.tool.call', errored: false });
    await seedRow({ accountId: ACCOUNT_A, meterName: 'mcp.tool.call', errored: false });

    const app = mountApp({
      user: { id: 'user-1', role: 'admin' },
      entitlements: { accountId: ACCOUNT_A },
    });
    const res = await app.request('/api/mcp/usage?range=24h');
    const body = (await res.json()) as {
      meters: Array<{
        meterName: string;
        total: number;
        durationCount: number;
        p50Ms: number | null;
        p95Ms: number | null;
      }>;
    };
    const tool = body.meters[0];
    expect(tool?.total).toBe(12);
    expect(tool?.durationCount).toBe(10);
    // percentile_disc(0.5) over [10..100] (sorted) discrete-picks the
    // 5th element = 50. percentile_disc(0.95) picks the value at the
    // 9.5-rounded position = 100.
    expect(tool?.p50Ms).toBe(50);
    expect(tool?.p95Ms).toBe(100);
  });

  it('returns null p50 / p95 when no rows have duration_ms', async () => {
    await seedAccount(ACCOUNT_A);
    await seedRow({ accountId: ACCOUNT_A, meterName: 'mcp.tool.call', errored: false });
    await seedRow({ accountId: ACCOUNT_A, meterName: 'mcp.tool.call', errored: true });

    const app = mountApp({
      user: { id: 'user-1', role: 'admin' },
      entitlements: { accountId: ACCOUNT_A },
    });
    const res = await app.request('/api/mcp/usage?range=24h');
    const body = (await res.json()) as {
      meters: Array<{ p50Ms: number | null; p95Ms: number | null; durationCount: number }>;
    };
    expect(body.meters[0]?.p50Ms).toBeNull();
    expect(body.meters[0]?.p95Ms).toBeNull();
    expect(body.meters[0]?.durationCount).toBe(0);
  });

  it('isolates rows by accountId — caller never sees another account\u2019s usage', async () => {
    await seedAccount(ACCOUNT_A);
    await seedAccount(ACCOUNT_B);
    await seedRow({
      accountId: ACCOUNT_A,
      meterName: 'mcp.tool.call',
      errored: false,
      durationMs: 100,
    });
    // 5 rows on B that should NOT appear in A's response
    for (let i = 0; i < 5; i++) {
      await seedRow({
        accountId: ACCOUNT_B,
        meterName: 'mcp.tool.call',
        errored: false,
      });
    }

    const app = mountApp({
      user: { id: 'user-a', role: 'admin' },
      entitlements: { accountId: ACCOUNT_A },
    });
    const res = await app.request('/api/mcp/usage?range=24h');
    const body = (await res.json()) as {
      meters: Array<{ total: number }>;
    };
    expect(body.meters[0]?.total).toBe(1);
  });

  it('filters by range — older rows are excluded', async () => {
    await seedAccount(ACCOUNT_A);
    const now = new Date();
    const fortyHoursAgo = new Date(now.getTime() - 40 * 60 * 60 * 1000);
    await seedRow({
      accountId: ACCOUNT_A,
      meterName: 'mcp.tool.call',
      errored: false,
      periodStart: now,
    });
    await seedRow({
      accountId: ACCOUNT_A,
      meterName: 'mcp.tool.call',
      errored: false,
      periodStart: fortyHoursAgo,
    });

    const app = mountApp({
      user: { id: 'user-1', role: 'admin' },
      entitlements: { accountId: ACCOUNT_A },
    });
    const res = await app.request('/api/mcp/usage?range=24h');
    const body24 = (await res.json()) as { meters: Array<{ total: number }> };
    expect(body24.meters[0]?.total).toBe(1);

    const res7d = await app.request('/api/mcp/usage?range=7d');
    const body7d = (await res7d.json()) as { meters: Array<{ total: number }> };
    expect(body7d.meters[0]?.total).toBe(2);
  });

  it('rejects invalid range values via zod validation', async () => {
    await seedAccount(ACCOUNT_A);
    const app = mountApp({
      user: { id: 'user-1', role: 'admin' },
      entitlements: { accountId: ACCOUNT_A },
    });
    const res = await app.request('/api/mcp/usage?range=999d');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
