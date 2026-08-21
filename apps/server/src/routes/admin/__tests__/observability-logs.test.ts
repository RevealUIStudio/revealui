/**
 * Auth coverage for GET /admin/logs — fleet-wide, operator-only.
 * Tenant owner/admin must not read other accounts' logs.
 */

import type { DatabaseClient } from '@revealui/db/client';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import observabilityApp from '../observability.js';

function createSelectChain(resolved: unknown): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const methods = ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy'] as const;
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (value: unknown) => void) => resolve(resolved);
  return chain;
}

const FLEET_OPERATOR = {
  id: 'op-1',
  role: 'admin',
  emailVerified: true as const,
  _json: { roles: ['super-admin'] },
};

function createApp(
  user: { id: string; role: string; emailVerified?: boolean; _json?: unknown } | null,
  selectResults: unknown[] = [],
) {
  let callIdx = 0;
  const db = {
    select: vi.fn(() => {
      const result = selectResults[callIdx] ?? [];
      callIdx += 1;
      return createSelectChain(result);
    }),
  } as unknown as DatabaseClient;

  const app = new Hono<{
    Variables: {
      db: DatabaseClient;
      user?: { id: string; role: string; emailVerified?: boolean; _json?: unknown };
    };
  }>();
  app.use('*', async (c, next) => {
    c.set('db', db);
    if (user) c.set('user', user);
    await next();
  });
  app.route('/', observabilityApp);
  return { app, db };
}

describe('GET /admin/logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no user is set', async () => {
    const { app } = createApp(null);
    const res = await app.fetch(new Request('http://localhost/logs'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is a tenant owner', async () => {
    const { app } = createApp({ id: 'owner-1', role: 'owner' });
    const res = await app.fetch(new Request('http://localhost/logs'));
    expect(res.status).toBe(403);
  });

  it('returns 403 when the user is a tenant admin', async () => {
    const { app } = createApp({ id: 'admin-1', role: 'admin' });
    const res = await app.fetch(new Request('http://localhost/logs'));
    expect(res.status).toBe(403);
  });

  it('returns 200 with paginated logs for a fleet operator', async () => {
    const row = {
      id: 'log-1',
      timestamp: new Date('2026-08-21T00:00:00Z'),
      level: 'info',
      message: 'boot',
      app: 'server',
      environment: 'test',
      requestId: null,
      userId: null,
      data: null,
    };
    const { app } = createApp(FLEET_OPERATOR, [[row], [{ total: 1 }]]);
    const res = await app.fetch(new Request('http://localhost/logs'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: Array<{ id: string; message: string }>;
      total: number;
    };
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
    expect(body.data[0]?.id).toBe('log-1');
    expect(body.data[0]?.message).toBe('boot');
  });
});
