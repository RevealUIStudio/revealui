/**
 * Unit tests for the CR8-P2-01 phase D jobs endpoints in the shared
 * admin observability route. Coverage is scoped to auth + response-
 * shape sanity; actual query correctness is exercised by the PGlite
 * integration test in `@revealui/test` (which can drive real Drizzle
 * queries against a real `jobs` table).
 */

import type { DatabaseClient } from '@revealui/db/client';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import observabilityApp from '../observability.js';

// The route file reads `c.get('db')` first and only falls back to
// `getClient()` if unset. Drizzle's query builder is a PromiseLike at
// every step — `await db.select().from(x).where(y)` resolves, and so does
// extending it with `.orderBy().limit().offset()`. Our stub mirrors that:
// every chain step returns the same object, and the object itself is
// thenable so `await`-ing at any depth resolves to the fixture.
function createSelectChain(resolved: unknown): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const methods = ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy'] as const;
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Thenable — awaiting the chain at any depth yields `resolved`.
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
  app.route('/', observabilityApp);
  return { app, db };
}

describe('GET /admin/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no user is set', async () => {
    const { app } = createApp(null);
    const res = await app.fetch(new Request('http://localhost/jobs'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not an admin', async () => {
    const { app } = createApp({ id: 'u1', role: 'editor' });
    const res = await app.fetch(new Request('http://localhost/jobs'));
    expect(res.status).toBe(403);
  });

  it('returns 200 with paginated jobs for an admin user', async () => {
    const jobRow = {
      id: 'agent.dispatch:t1',
      name: 'agent.dispatch',
      data: { ticketId: 't1' },
      state: 'completed',
      priority: 0,
      retryCount: 0,
      retryLimit: 3,
      startAfter: new Date('2026-04-22T00:00:00Z'),
      expireAt: null,
      output: { success: true, output: 'done' },
      lockedBy: null,
      lockedUntil: null,
      lastError: null,
      createdAt: new Date('2026-04-22T00:00:00Z'),
      startedAt: new Date('2026-04-22T00:00:01Z'),
      completedAt: new Date('2026-04-22T00:00:03Z'),
    };
    const { app } = createApp({ id: 'u1', role: 'admin' }, [[jobRow], [{ total: 1 }]]);
    const res = await app.fetch(new Request('http://localhost/jobs?limit=10&offset=0'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: Array<Record<string, unknown>>;
      total: number;
    };
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: 'agent.dispatch:t1',
      name: 'agent.dispatch',
      state: 'completed',
      retryCount: 0,
    });
  });

  it('rejects invalid state filter values at the OpenAPI layer', async () => {
    const { app } = createApp({ id: 'u1', role: 'admin' });
    const res = await app.fetch(new Request('http://localhost/jobs?state=not-a-state'));
    // OpenAPI validation rejects with 400.
    expect(res.status).toBe(400);
  });
});

describe('GET /admin/jobs/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no user is set', async () => {
    const { app } = createApp(null);
    const res = await app.fetch(new Request('http://localhost/jobs/summary'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not an admin', async () => {
    const { app } = createApp({ id: 'u1', role: 'editor' });
    const res = await app.fetch(new Request('http://localhost/jobs/summary'));
    expect(res.status).toBe(403);
  });

  it('pivots per-handler rows into {completed, failed, running} buckets', async () => {
    const stateRows = [
      { state: 'created', total: 2 },
      { state: 'active', total: 1 },
      { state: 'completed', total: 10 },
      { state: 'failed', total: 1 },
    ];
    const handlerRows = [
      { name: 'agent.dispatch', state: 'completed', total: 8 },
      { name: 'agent.dispatch', state: 'failed', total: 1 },
      { name: 'saga:billing', state: 'completed', total: 2 },
      { name: 'saga:billing', state: 'active', total: 1 },
    ];
    const failureRows = [
      {
        id: 'agent.dispatch:t-fail',
        name: 'agent.dispatch',
        lastError: 'LLM provider error',
        retryCount: 3,
        completedAt: new Date('2026-04-22T01:00:00Z'),
        data: {},
        state: 'failed',
        priority: 0,
        retryLimit: 3,
        startAfter: new Date('2026-04-22T00:00:00Z'),
        expireAt: null,
        output: null,
        lockedBy: null,
        lockedUntil: null,
        createdAt: new Date('2026-04-22T00:00:00Z'),
        startedAt: new Date('2026-04-22T00:00:01Z'),
      },
    ];
    const { app } = createApp({ id: 'u1', role: 'admin' }, [stateRows, handlerRows, failureRows]);
    const res = await app.fetch(new Request('http://localhost/jobs/summary'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      stateCounts: Record<string, number>;
      byHandler24h: Array<{ name: string; completed: number; failed: number; running: number }>;
      recentFailures: Array<{ id: string; name: string; lastError: string | null }>;
      timestamp: string;
    };
    expect(body.success).toBe(true);
    expect(body.stateCounts).toEqual({
      created: 2,
      active: 1,
      completed: 10,
      failed: 1,
      retry: 0,
    });

    const byName = new Map(body.byHandler24h.map((h) => [h.name, h]));
    expect(byName.get('agent.dispatch')).toEqual({
      name: 'agent.dispatch',
      completed: 8,
      failed: 1,
      running: 0,
    });
    expect(byName.get('saga:billing')).toEqual({
      name: 'saga:billing',
      completed: 2,
      failed: 0,
      running: 1,
    });

    expect(body.recentFailures).toHaveLength(1);
    expect(body.recentFailures[0]).toMatchObject({
      id: 'agent.dispatch:t-fail',
      name: 'agent.dispatch',
      lastError: 'LLM provider error',
    });
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
