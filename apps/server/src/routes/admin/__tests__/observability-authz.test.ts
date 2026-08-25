/**
 * Tenant isolation for fleet-wide observability siblings.
 *
 * GET /admin/logs is already operator-only. Errors, audit list/export,
 * webhooks, and jobs query unscoped tables — hosted CMS admin/owner must
 * not paginate or export other tenants' rows.
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

const TENANT_OWNER = { id: 'owner-1', role: 'owner', emailVerified: true as const };
const TENANT_ADMIN = { id: 'admin-1', role: 'admin', emailVerified: true as const };

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

const FLEET_PATHS = [
  '/logs',
  '/errors',
  '/audit',
  '/audit/export?format=json',
  '/webhooks',
  '/jobs',
  '/jobs/summary',
] as const;

describe('fleet-wide observability authz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const path of FLEET_PATHS) {
    describe(path, () => {
      it('returns 401 when no user is set', async () => {
        const { app } = createApp(null);
        const res = await app.fetch(new Request(`http://localhost${path}`));
        expect(res.status).toBe(401);
      });

      it('returns 403 for a hosted tenant owner', async () => {
        const { app } = createApp(TENANT_OWNER);
        const res = await app.fetch(new Request(`http://localhost${path}`));
        expect(res.status).toBe(403);
      });

      it('returns 403 for a hosted CMS admin', async () => {
        const { app } = createApp(TENANT_ADMIN);
        const res = await app.fetch(new Request(`http://localhost${path}`));
        expect(res.status).toBe(403);
      });
    });
  }

  it('returns 200 on GET /errors for a fleet operator', async () => {
    const row = {
      id: 'err-1',
      timestamp: new Date('2026-08-24T00:00:00Z'),
      level: 'error',
      message: 'boom',
      stack: 'Error: boom',
      app: 'api',
      context: 'server',
      environment: 'test',
      url: null,
      userId: 'other-tenant',
      requestId: null,
      metadata: null,
    };
    const { app } = createApp(FLEET_OPERATOR, [[row], [{ total: 1 }]]);
    const res = await app.fetch(new Request('http://localhost/errors'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      total: number;
      data: Array<{ id: string }>;
    };
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
    expect(body.data[0]?.id).toBe('err-1');
  });

  it('returns 200 on GET /audit for a fleet operator', async () => {
    const row = {
      id: 'a1',
      timestamp: new Date('2026-08-24T00:00:00Z'),
      eventType: 'auth.login',
      severity: 'info',
      agentId: 'user-1',
      taskId: null,
      sessionId: null,
      payload: { tenantSecret: 'other-account' },
      policyViolations: [],
    };
    const { app } = createApp(FLEET_OPERATOR, [[row], [{ total: 1 }], []]);
    const res = await app.fetch(new Request('http://localhost/audit'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; total: number };
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
  });

  it('returns 200 on GET /audit/export for a fleet operator', async () => {
    const row = {
      id: 'a1',
      timestamp: new Date('2026-08-24T00:00:00Z'),
      eventType: 'auth.login',
      severity: 'info',
      agentId: 'user-1',
      taskId: null,
      sessionId: null,
      payload: {},
      policyViolations: [],
      signature: null,
      previousSignature: null,
    };
    const { app } = createApp(FLEET_OPERATOR, [[row], []]);
    const res = await app.fetch(new Request('http://localhost/audit/export?format=json'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rowCount: number };
    expect(body.rowCount).toBe(1);
  });

  it('returns 200 on GET /webhooks for a fleet operator', async () => {
    const row = {
      id: 'wh-1',
      eventType: 'invoice.paid',
      processedAt: new Date('2026-08-24T00:00:00Z'),
    };
    const { app } = createApp(FLEET_OPERATOR, [[row], [{ total: 1 }]]);
    const res = await app.fetch(new Request('http://localhost/webhooks'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; total: number };
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
  });

  it('returns 200 on GET /jobs for a fleet operator', async () => {
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
      output: { success: true },
      lockedBy: null,
      lockedUntil: null,
      lastError: null,
      createdAt: new Date('2026-04-22T00:00:00Z'),
      startedAt: new Date('2026-04-22T00:00:01Z'),
      completedAt: new Date('2026-04-22T00:00:03Z'),
    };
    const { app } = createApp(FLEET_OPERATOR, [[jobRow], [{ total: 1 }]]);
    const res = await app.fetch(new Request('http://localhost/jobs'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; total: number };
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
  });

  it('returns 200 on GET /jobs/summary for a fleet operator', async () => {
    const { app } = createApp(FLEET_OPERATOR, [[], [], []]);
    const res = await app.fetch(new Request('http://localhost/jobs/summary'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('keeps GET /logs operator-only (hosted admin cannot read)', async () => {
    const { app } = createApp(TENANT_ADMIN);
    const res = await app.fetch(new Request('http://localhost/logs'));
    expect(res.status).toBe(403);
  });
});
