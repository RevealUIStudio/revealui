/**
 * Unit tests for the GAP-154 Phase 4 admin coordination routes.
 * Coverage scoped to auth gating + response shape sanity. Real Drizzle
 * query correctness against a real coordination_* schema is covered by
 * the schema-smoke test in `@revealui/db` and the daemon's own
 * coordination.test.ts which exercises the dual-write path.
 */

import type { DatabaseClient } from '@revealui/db/client';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import coordinationApp from '../coordination.js';

// Same chain stub used by observability-jobs.test.ts. Drizzle's query
// builder returns a thenable at every depth; we mirror that so awaiting
// at any point yields the fixture.
function createSelectChain(resolved: unknown): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const methods = ['from', 'leftJoin', 'where', 'orderBy', 'limit', 'offset', 'groupBy'] as const;
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
  app.route('/', coordinationApp);
  return { app, db };
}

describe('GET /admin/coordination/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no user is set', async () => {
    const { app } = createApp(null);
    const res = await app.fetch(new Request('http://localhost/sessions'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not an admin', async () => {
    const { app } = createApp({ id: 'u1', role: 'editor' });
    const res = await app.fetch(new Request('http://localhost/sessions'));
    expect(res.status).toBe(403);
  });

  it('returns 200 with empty data when no rows exist', async () => {
    const { app } = createApp({ id: 'u1', role: 'admin' }, [[], [{ total: 0 }]]);
    const res = await app.fetch(new Request('http://localhost/sessions'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: unknown[];
      total: number;
      limit: number;
      offset: number;
      timestamp: string;
    };
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.limit).toBe(100);
    expect(body.offset).toBe(0);
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns 200 with paginated sessions for an admin user', async () => {
    const startedAt = new Date(Date.now() - 60_000); // 1 minute ago
    const lastSeen = new Date(Date.now() - 30_000);
    const sessionRow = {
      id: 'agent-system',
      agentId: 'agent-system',
      task: 'building coordination widget',
      status: 'active',
      pid: 12345,
      startedAt,
      endedAt: null,
      tools: { Read: 5, Write: 2 },
      env: 'WSL/Ubuntu',
      lastSeen,
      agentMetadata: { name: 'agent-system' },
    };
    const { app } = createApp({ id: 'u1', role: 'admin' }, [[sessionRow], [{ total: 1 }]]);
    const res = await app.fetch(new Request('http://localhost/sessions?limit=10&offset=0'));
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
      id: 'agent-system',
      agentId: 'agent-system',
      agentName: 'agent-system',
      env: 'WSL/Ubuntu',
      task: 'building coordination widget',
      status: 'active',
      pid: 12345,
      endedAt: null,
      tools: { Read: 5, Write: 2 },
      isStale: false,
    });
    // ageSeconds should be a small positive number (within a few seconds of 60).
    const session = body.data[0] as { ageSeconds: number };
    expect(session.ageSeconds).toBeGreaterThanOrEqual(59);
    expect(session.ageSeconds).toBeLessThan(120);
  });

  it('flags isStale=true when started_at is older than 7 days', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const sessionRow = {
      id: 'old-agent',
      agentId: 'old-agent',
      task: '(starting)',
      status: 'active',
      pid: null,
      startedAt: eightDaysAgo,
      endedAt: null,
      tools: null,
      env: 'WSL/Ubuntu',
      lastSeen: eightDaysAgo,
      agentMetadata: null,
    };
    const { app } = createApp({ id: 'u1', role: 'admin' }, [[sessionRow], [{ total: 1 }]]);
    const res = await app.fetch(new Request('http://localhost/sessions'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ isStale: boolean; agentName: unknown }> };
    expect(body.data[0]?.isStale).toBe(true);
    expect(body.data[0]?.agentName).toBeNull();
  });

  it('rejects scope outside the allowed enum', async () => {
    const { app } = createApp({ id: 'u1', role: 'admin' });
    const res = await app.fetch(new Request('http://localhost/sessions?scope=bogus'));
    // OpenAPIHono surfaces zod-coerce failures as 400.
    expect(res.status).toBe(400);
  });

  it('rejects limit above the cap', async () => {
    const { app } = createApp({ id: 'u1', role: 'admin' });
    const res = await app.fetch(new Request('http://localhost/sessions?limit=999'));
    expect(res.status).toBe(400);
  });

  it('accepts agentId filter param', async () => {
    const { app } = createApp({ id: 'u1', role: 'admin' }, [[], [{ total: 0 }]]);
    const res = await app.fetch(
      new Request('http://localhost/sessions?agentId=agent-system&scope=all'),
    );
    expect(res.status).toBe(200);
  });

  it('handles a session with non-canonical status by coercing to active', async () => {
    // Defensive: the coordination_sessions CHECK constraint is enforced at
    // the DB level, but if a row somehow surfaces with an unexpected status,
    // the route narrows to 'active' rather than blowing up.
    const sessionRow = {
      id: 'weird',
      agentId: 'weird',
      task: 'unknown',
      status: 'pending', // not in the allowed set
      pid: null,
      startedAt: new Date(),
      endedAt: null,
      tools: null,
      env: null,
      lastSeen: null,
      agentMetadata: null,
    };
    const { app } = createApp({ id: 'u1', role: 'admin' }, [[sessionRow], [{ total: 1 }]]);
    const res = await app.fetch(new Request('http://localhost/sessions'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ status: string }> };
    expect(body.data[0]?.status).toBe('active');
  });
});
