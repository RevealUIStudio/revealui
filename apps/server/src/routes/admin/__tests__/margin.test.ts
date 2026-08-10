/**
 * Unit tests for GAP-256 admin margin summary route.
 * Auth gating + empty/latest shape; DB is a thenable select chain stub.
 */

import type { DatabaseClient } from '@revealui/db/client';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import marginApp from '../margin.js';

function createSelectChain(resolved: unknown): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const methods = ['from', 'where', 'orderBy', 'limit', 'offset'] as const;
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (value: unknown) => void) => resolve(resolved);
  return chain;
}

function createApp(user: { id: string; role: string } | null, selectResults: unknown[] = []) {
  let callIdx = 0;
  const db = {
    select: vi.fn(() => {
      const result = selectResults[callIdx] ?? [];
      callIdx += 1;
      return createSelectChain(result);
    }),
  } as unknown as DatabaseClient;

  const app = new Hono<{
    Variables: { db: DatabaseClient; user?: { id: string; role: string } };
  }>();
  app.use('*', async (c, next) => {
    c.set('db', db);
    if (user) c.set('user', user);
    await next();
  });
  app.route('/', marginApp);
  return { app, db };
}

describe('GET /admin/margin/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no user is set', async () => {
    const { app } = createApp(null);
    const res = await app.fetch(new Request('http://localhost/summary'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not an admin', async () => {
    const { app } = createApp({ id: 'u1', role: 'editor' });
    const res = await app.fetch(new Request('http://localhost/summary'));
    expect(res.status).toBe(403);
  });

  it('returns empty summary when no snapshots exist', async () => {
    const { app } = createApp({ id: 'u1', role: 'admin' }, [[]]);
    const res = await app.fetch(new Request('http://localhost/summary'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { latest: null; history: unknown[]; topAccountsByCost: unknown[] };
    };
    expect(body.success).toBe(true);
    expect(body.data.latest).toBeNull();
    expect(body.data.history).toEqual([]);
    expect(body.data.topAccountsByCost).toEqual([]);
  });

  it('returns latest snapshot and top accounts for owner role', async () => {
    const computedAt = new Date('2026-08-09T12:00:00.000Z');
    const snapshot = {
      id: 'snap-1',
      periodDate: '2026-08-09',
      freeCostCents: 100,
      paidCostCents: 50,
      totalCostCents: 150,
      revenueCents: 500,
      netCents: 350,
      projected7dCents: 400,
      freeCostRatio: '0.67',
      mode: 'open' as const,
      accountCountFree: 10,
      accountCountPaid: 2,
      computedAt,
      trend: { slope: 1 },
      rates: {},
      createdAt: computedAt,
    };
    const account = {
      id: 'amd-1',
      accountId: 'acct-1',
      periodDate: '2026-08-09',
      costCents: 80,
      agentTasks: 3,
      revenueCents: 0,
      tier: 'free',
      createdAt: computedAt,
    };
    const { app } = createApp({ id: 'owner', role: 'owner' }, [[snapshot], [account]]);
    const res = await app.fetch(new Request('http://localhost/summary'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: {
        latest: { mode: string; netCents: number; computedAt: string };
        history: unknown[];
        topAccountsByCost: Array<{ accountId: string; netCents: number }>;
      };
    };
    expect(body.data.latest?.mode).toBe('open');
    expect(body.data.latest?.netCents).toBe(350);
    expect(body.data.latest?.computedAt).toBe(computedAt.toISOString());
    expect(body.data.history).toHaveLength(1);
    expect(body.data.topAccountsByCost[0]?.accountId).toBe('acct-1');
    expect(body.data.topAccountsByCost[0]?.netCents).toBe(-80);
  });
});
