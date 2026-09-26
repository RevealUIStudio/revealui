/**
 * Plan task quota must stay inside the limit when requests overlap.
 *
 * Admission used to read `agent_task_usage` and increment it in a later
 * statement. Overlapping requests can all observe a count under the quota
 * and all increment. The Neon HTTP driver has no transactions, so the
 * decision has to be one conditional write. `Promise.all` overlaps those
 * statements on a real Postgres (PGlite).
 */

import { agentCreditBalance, agentTaskUsage } from '@revealui/db/schema';
import { cleanTables, createTestDb, seedTestUser, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let testDb: TestDb;

vi.mock('@revealui/db', async () => {
  const actual = await vi.importActual<typeof import('@revealui/db')>('@revealui/db');
  return {
    ...actual,
    getClient: () => testDb.drizzle,
  };
});

import { requireTaskQuota } from '../task-quota.js';

interface QuotaUser {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

const USER: QuotaUser = {
  id: 'user-quota-race',
  email: 'quota-race@example.com',
  name: 'Quota Race',
  role: 'admin',
};

function createApp(quota: number) {
  const app = new Hono<{
    Variables: {
      user: QuotaUser | undefined;
      entitlements?: { limits?: { maxAgentTasks?: number } };
    };
  }>();

  app.use('/*', async (c, next) => {
    c.set('user', USER);
    c.set('entitlements', { limits: { maxAgentTasks: quota } });
    return next();
  });
  app.use('/*', requireTaskQuota);
  app.post('/test', (c) => c.json({ ok: true }));
  return app;
}

function cycleStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function usageRow(): Promise<{ count: number; overage: number } | undefined> {
  const [row] = await testDb.drizzle
    .select({ count: agentTaskUsage.count, overage: agentTaskUsage.overage })
    .from(agentTaskUsage)
    .where(eq(agentTaskUsage.userId, USER.id));
  return row;
}

describe('requireTaskQuota plan quota admission', () => {
  beforeAll(async () => {
    testDb = await createTestDb();
    await seedTestUser(testDb.drizzle, {
      id: USER.id,
      email: USER.email ?? undefined,
      name: USER.name,
      role: 'admin',
    });
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    await cleanTables(testDb.drizzle, ['agent_task_usage', 'agent_credit_balance']);
  });

  it('allows one task under the quota and records a single count', async () => {
    const app = createApp(2);
    const res = await app.request('/test', { method: 'POST' });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    await expect(usageRow()).resolves.toMatchObject({ count: 1, overage: 0 });
  });

  it('returns 429 with the stored count once the quota is already met', async () => {
    const quota = 2;
    await testDb.drizzle.insert(agentTaskUsage).values({
      userId: USER.id,
      cycleStart: cycleStart(),
      count: quota,
      overage: 0,
    });

    const app = createApp(quota);
    const res = await app.request('/test', { method: 'POST' });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe('Agent task quota exceeded for this billing cycle.');
    expect(body.used).toBe(quota);
    expect(body.quota).toBe(quota);
    expect(new Date(body.resetAt).getUTCDate()).toBe(1);
    await expect(usageRow()).resolves.toMatchObject({ count: quota });
  });

  it('denies a zero quota without reserving a task', async () => {
    const app = createApp(0);
    const res = await app.request('/test', { method: 'POST' });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.used).toBe(0);
    expect(body.quota).toBe(0);
    const row = await usageRow();
    expect(row?.count ?? 0).toBe(0);
  });

  it('still spends one prepaid credit after the plan quota is exhausted', async () => {
    const quota = 1;
    await testDb.drizzle.insert(agentTaskUsage).values({
      userId: USER.id,
      cycleStart: cycleStart(),
      count: quota,
      overage: 0,
    });
    await testDb.drizzle.insert(agentCreditBalance).values({
      userId: USER.id,
      balance: 1,
      totalPurchased: 1,
    });

    const app = createApp(quota);
    const res = await app.request('/test', { method: 'POST' });

    expect(res.status).toBe(200);
    const [credit] = await testDb.drizzle
      .select({ balance: agentCreditBalance.balance })
      .from(agentCreditBalance)
      .where(eq(agentCreditBalance.userId, USER.id));
    expect(credit?.balance).toBe(0);
    await expect(usageRow()).resolves.toMatchObject({ count: quota + 1, overage: 1 });
  });

  it.each([
    { quota: 1, racers: 8 },
    { quota: 4, racers: 12 },
  ])('admits at most $quota of $racers overlapping requests', async ({ quota, racers }) => {
    const app = createApp(quota);
    const responses = await Promise.all(
      Array.from({ length: racers }, () => app.request('/test', { method: 'POST' })),
    );

    const admitted = responses.filter((res) => res.status === 200);
    const denied = responses.filter((res) => res.status !== 200);

    expect(admitted).toHaveLength(quota);
    expect(denied).toHaveLength(racers - quota);
    for (const res of denied) {
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe('Agent task quota exceeded for this billing cycle.');
      expect(body.quota).toBe(quota);
      expect(body.used).toBeGreaterThanOrEqual(quota);
    }

    await expect(usageRow()).resolves.toMatchObject({ count: quota });
  });
});
