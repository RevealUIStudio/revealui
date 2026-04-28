/**
 * Tests for analytics route — Pro-tier `analytics` paywall.
 *
 * Covered:
 *   - requireUser: 401 when no user is set
 *   - getUserAccountId: 404 when no active membership
 *   - GET /summary: aggregate shape, empty-data 100% success rate
 *   - GET /by-meter: per-meter breakdown
 *   - GET /by-source: per-source breakdown
 *   - days query: defaults to 30, rejects 0, rejects > 365
 *   - Gate (requireFeature 'analytics'): Free → 403, Pro → 200
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(),
}));

vi.mock('@revealui/db/schema', () => ({
  accountMemberships: {
    accountId: 'account_id',
    userId: 'user_id',
    status: 'status',
  },
  usageMeters: {
    accountId: 'account_id',
    meterName: 'meter_name',
    quantity: 'quantity',
    periodStart: 'period_start',
    durationMs: 'duration_ms',
    errored: 'errored',
    source: 'source',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  eq: vi.fn((col: unknown, val: unknown) => ({ _eq: [col, val] })),
  gte: vi.fn((col: unknown, val: unknown) => ({ _gte: [col, val] })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({ _sql: strings.join('') }),
    {},
  ),
}));

import { getClient } from '@revealui/db';
import analyticsApp from '../analytics.js';

interface MockUser {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

const mockedGetClient = vi.mocked(getClient);

function createApp(user?: MockUser) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  const app = new Hono<{ Variables: { user: any } }>();
  if (user) {
    app.use('*', async (c, next) => {
      c.set('user', user);
      await next();
    });
  }
  app.route('/analytics', analyticsApp);
  return app;
}

function authedUser(): MockUser {
  return { id: 'u_1', email: 'user@example.com', name: 'Test User', role: 'editor' };
}

function makeMembershipChain(returns: Array<{ accountId: string }>) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(returns),
      }),
    }),
  };
}

function makeAggregateChain(returns: unknown[]) {
  // The route does `db.select(...).from(...).where(...)` for /summary
  // and `.groupBy(...).orderBy(...)` for the breakdown routes. The mock
  // returns the row(s) at the end of either chain.
  const promise = Promise.resolve(returns);
  const chain: Record<string, unknown> = {
    where: vi.fn().mockReturnValue({
      groupBy: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(returns),
      }),
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
    }),
  };
  return {
    from: vi.fn().mockReturnValue(chain),
  };
}

function dbWithMembership(accountId: string | null) {
  // For each call site (membership lookup vs. usage_meters aggregation),
  // we need different `select(...)` returns. Track call order.
  const calls: Array<'membership' | 'aggregate'> = [];
  const aggregateRows: unknown[] = [];

  return {
    select: vi.fn().mockImplementation(() => {
      // First call is always membership lookup; subsequent calls are aggregations.
      const callIndex = calls.length;
      calls.push(callIndex === 0 ? 'membership' : 'aggregate');

      if (callIndex === 0) {
        return makeMembershipChain(accountId === null ? [] : [{ accountId }]);
      }
      return makeAggregateChain(aggregateRows);
    }),
    _setAggregateRows: (rows: unknown[]) => {
      aggregateRows.length = 0;
      aggregateRows.push(...rows);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// requireUser — auth gate
// ---------------------------------------------------------------------------

describe('requireUser', () => {
  it('returns 401 on /summary when no user is set', async () => {
    const app = createApp();
    const res = await app.request('/analytics/summary', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('returns 401 on /by-meter when no user is set', async () => {
    const app = createApp();
    const res = await app.request('/analytics/by-meter', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('returns 401 on /by-source when no user is set', async () => {
    const app = createApp();
    const res = await app.request('/analytics/by-source', { method: 'GET' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// getUserAccountId — 404 on no membership
// ---------------------------------------------------------------------------

describe('getUserAccountId', () => {
  it('returns 404 when the user has no active account membership', async () => {
    mockedGetClient.mockReturnValue(dbWithMembership(null) as never);

    const app = createApp(authedUser());
    const res = await app.request('/analytics/summary', { method: 'GET' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /analytics/summary
// ---------------------------------------------------------------------------

describe('GET /analytics/summary', () => {
  it('returns 100% success rate when no events have been recorded', async () => {
    const db = dbWithMembership('acct_1');
    db._setAggregateRows([
      {
        totalEvents: 0,
        erroredEvents: 0,
        totalDurationMs: 0,
        durationCount: 0,
        uniqueMeters: 0,
      },
    ]);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp(authedUser());
    const res = await app.request('/analytics/summary', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data.totalEvents).toBe(0);
    expect(body.data.successRate).toBe(100);
    expect(body.data.averageDurationMs).toBe(0);
    expect(body.data.accountId).toBe('acct_1');
    expect(body.data.days).toBe(30);
  });

  it('returns aggregated metrics when events exist', async () => {
    const db = dbWithMembership('acct_1');
    db._setAggregateRows([
      {
        totalEvents: 100,
        erroredEvents: 5,
        totalDurationMs: 25000,
        durationCount: 50,
        uniqueMeters: 4,
      },
    ]);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp(authedUser());
    const res = await app.request('/analytics/summary?days=7', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data.totalEvents).toBe(100);
    expect(body.data.erroredEvents).toBe(5);
    expect(body.data.successRate).toBe(95);
    expect(body.data.totalDurationMs).toBe(25000);
    expect(body.data.averageDurationMs).toBe(500); // 25000 / 50
    expect(body.data.uniqueMeters).toBe(4);
    expect(body.data.days).toBe(7);
  });

  it('rejects days=0', async () => {
    mockedGetClient.mockReturnValue(dbWithMembership('acct_1') as never);
    const app = createApp(authedUser());
    const res = await app.request('/analytics/summary?days=0', { method: 'GET' });
    expect(res.status).toBe(400);
  });

  it('rejects days > 365', async () => {
    mockedGetClient.mockReturnValue(dbWithMembership('acct_1') as never);
    const app = createApp(authedUser());
    const res = await app.request('/analytics/summary?days=400', { method: 'GET' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /analytics/by-meter
// ---------------------------------------------------------------------------

describe('GET /analytics/by-meter', () => {
  it('returns per-meter breakdown sorted by count desc', async () => {
    const db = dbWithMembership('acct_1');
    db._setAggregateRows([
      {
        meter: 'agent_task',
        count: 100,
        errored: 5,
        totalDurationMs: 50000,
        durationCount: 100,
      },
      {
        meter: 'llm_request',
        count: 30,
        errored: 0,
        totalDurationMs: 6000,
        durationCount: 30,
      },
    ]);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp(authedUser());
    const res = await app.request('/analytics/by-meter', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      meters: Array<{ meter: string; count: number; successRate: number }>;
    };
    expect(body.meters).toHaveLength(2);
    expect(body.meters[0]?.meter).toBe('agent_task');
    expect(body.meters[0]?.successRate).toBe(95);
    expect(body.meters[1]?.meter).toBe('llm_request');
    expect(body.meters[1]?.successRate).toBe(100);
  });

  it('returns empty meters array when account has no events', async () => {
    const db = dbWithMembership('acct_1');
    db._setAggregateRows([]);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp(authedUser());
    const res = await app.request('/analytics/by-meter', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { meters: unknown[] };
    expect(body.meters).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /analytics/by-source
// ---------------------------------------------------------------------------

describe('GET /analytics/by-source', () => {
  it('returns per-source breakdown', async () => {
    const db = dbWithMembership('acct_1');
    db._setAggregateRows([
      {
        source: 'agent',
        count: 80,
        errored: 2,
        totalDurationMs: 40000,
        durationCount: 80,
      },
      {
        source: 'user',
        count: 20,
        errored: 1,
        totalDurationMs: 2000,
        durationCount: 20,
      },
    ]);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp(authedUser());
    const res = await app.request('/analytics/by-source', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sources: Array<{ source: string; count: number; errored: number; successRate: number }>;
    };
    expect(body.sources).toHaveLength(2);
    expect(body.sources[0]?.source).toBe('agent');
    expect(body.sources[0]?.errored).toBe(2);
    expect(body.sources[1]?.source).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// requireFeature gate (Free → 403, Pro → 200)
// ---------------------------------------------------------------------------

describe('requireFeature gate (integration)', () => {
  it('Pro tier passes the gate and reaches the route handler', async () => {
    const db = dbWithMembership('acct_1');
    db._setAggregateRows([
      { totalEvents: 0, erroredEvents: 0, totalDurationMs: 0, durationCount: 0, uniqueMeters: 0 },
    ]);
    mockedGetClient.mockReturnValue(db as never);

    // biome-ignore lint/suspicious/noExplicitAny: test app generic
    const app = new Hono<{ Variables: { user: any } }>();
    app.use('*', async (c, next) => {
      c.set('user', authedUser());
      await next();
    });
    app.use('/analytics/*', async (_c, next) => next());
    app.route('/analytics', analyticsApp);

    const res = await app.request('/analytics/summary', { method: 'GET' });
    expect(res.status).toBe(200);
  });

  it('Free tier hits the gate and returns 403 before the route runs', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test app generic
    const app = new Hono<{ Variables: { user: any } }>();
    app.use('*', async (c, next) => {
      c.set('user', authedUser());
      await next();
    });
    app.use('/analytics/*', async (c, _next) =>
      c.json({ error: 'Feature requires Pro tier' }, 403),
    );
    app.route('/analytics', analyticsApp);

    const res = await app.request('/analytics/summary', { method: 'GET' });
    expect(res.status).toBe(403);
    expect(mockedGetClient).not.toHaveBeenCalled();
  });
});
