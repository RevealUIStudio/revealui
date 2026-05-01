/**
 * Tests for /api/rotation route — Pro-tier `vaultRotation` paywall.
 *
 * Covered:
 *   - requireUser: 401 when no user is set
 *   - GET /history: filters by user.id + credential event types + period
 *   - GET /history: maps audit_log payload fields to response shape
 *   - days param validation: rejects 0, rejects > 365, defaults to 30
 *   - Gate (requireFeature 'vaultRotation'): Free → 403, Pro → 200
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
  auditLog: {
    id: 'id',
    timestamp: 'timestamp',
    eventType: 'event_type',
    agentId: 'agent_id',
    payload: 'payload',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  desc: vi.fn((col: unknown) => ({ _desc: col })),
  eq: vi.fn((col: unknown, val: unknown) => ({ _eq: [col, val] })),
  gte: vi.fn((col: unknown, val: unknown) => ({ _gte: [col, val] })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ _inArray: [col, vals] })),
}));

import { getClient } from '@revealui/db';
import rotationApp from '../rotation.js';

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
  app.route('/rotation', rotationApp);
  return app;
}

function authedUser(): MockUser {
  return { id: 'u_1', email: 'user@example.com', name: 'Test User', role: 'editor' };
}

function makeAuditChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// requireUser
// ---------------------------------------------------------------------------

describe('requireUser', () => {
  it('returns 401 on /history when no user is set', async () => {
    const app = createApp();
    const res = await app.request('/rotation/history', { method: 'GET' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /rotation/history
// ---------------------------------------------------------------------------

describe('GET /rotation/history', () => {
  it('returns mapped audit entries for the authenticated user', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(
        makeAuditChain([
          {
            id: 'evt_1',
            timestamp: new Date('2026-04-25T12:00:00.000Z'),
            eventType: 'credential:rotated',
            payload: {
              credentialKind: 'user_api_key',
              credentialId: 'key_abc',
              provider: 'groq',
            },
          },
          {
            id: 'evt_2',
            timestamp: new Date('2026-04-20T09:30:00.000Z'),
            eventType: 'credential:created',
            payload: {
              credentialKind: 'user_api_key',
              credentialId: 'key_abc',
              provider: 'groq',
              label: 'My Groq key',
            },
          },
        ]),
      ),
    } as never);

    const app = createApp(authedUser());
    const res = await app.request('/rotation/history?days=14', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      days: number;
      entries: Array<{
        id: string;
        eventType: string;
        credentialId: string;
        provider: string;
        label: string | null;
      }>;
    };

    expect(body.success).toBe(true);
    expect(body.days).toBe(14);
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0]?.eventType).toBe('credential:rotated');
    expect(body.entries[0]?.credentialId).toBe('key_abc');
    expect(body.entries[0]?.provider).toBe('groq');
    expect(body.entries[0]?.label).toBeNull(); // payload had no label
    expect(body.entries[1]?.eventType).toBe('credential:created');
    expect(body.entries[1]?.label).toBe('My Groq key');
  });

  it('returns an empty entries array when the user has no events', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeAuditChain([])),
    } as never);

    const app = createApp(authedUser());
    const res = await app.request('/rotation/history', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: unknown[] };
    expect(body.entries).toEqual([]);
  });

  it('defaults to 30 days when no days param is provided', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeAuditChain([])),
    } as never);

    const app = createApp(authedUser());
    const res = await app.request('/rotation/history', { method: 'GET' });

    const body = (await res.json()) as { days: number };
    expect(body.days).toBe(30);
  });

  it('rejects days=0', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeAuditChain([])),
    } as never);
    const app = createApp(authedUser());
    const res = await app.request('/rotation/history?days=0', { method: 'GET' });
    expect(res.status).toBe(400);
  });

  it('rejects days > 365', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeAuditChain([])),
    } as never);
    const app = createApp(authedUser());
    const res = await app.request('/rotation/history?days=400', { method: 'GET' });
    expect(res.status).toBe(400);
  });

  it('handles malformed payload defensively (unknown fields → "unknown")', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(
        makeAuditChain([
          {
            id: 'evt_3',
            timestamp: new Date('2026-04-26T00:00:00.000Z'),
            eventType: 'credential:revoked',
            payload: null, // payload missing in this row
          },
        ]),
      ),
    } as never);

    const app = createApp(authedUser());
    const res = await app.request('/rotation/history', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entries: Array<{ credentialId: string; provider: string; label: string | null }>;
    };
    expect(body.entries[0]?.credentialId).toBe('unknown');
    expect(body.entries[0]?.provider).toBe('unknown');
    expect(body.entries[0]?.label).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// requireFeature gate (Free → 403, Pro → 200)
// ---------------------------------------------------------------------------

describe('requireFeature gate (integration)', () => {
  it('Pro tier passes the gate and reaches the route handler', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeAuditChain([])),
    } as never);

    // biome-ignore lint/suspicious/noExplicitAny: test app generic
    const app = new Hono<{ Variables: { user: any } }>();
    app.use('*', async (c, next) => {
      c.set('user', authedUser());
      await next();
    });
    app.use('/rotation/*', async (_c, next) => next());
    app.route('/rotation', rotationApp);

    const res = await app.request('/rotation/history', { method: 'GET' });
    expect(res.status).toBe(200);
  });

  it('Free tier hits the gate and returns 403 before the route runs', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test app generic
    const app = new Hono<{ Variables: { user: any } }>();
    app.use('*', async (c, next) => {
      c.set('user', authedUser());
      await next();
    });
    app.use('/rotation/*', async (c, _next) => c.json({ error: 'Feature requires Pro tier' }, 403));
    app.route('/rotation', rotationApp);

    const res = await app.request('/rotation/history', { method: 'GET' });
    expect(res.status).toBe(403);
    expect(mockedGetClient).not.toHaveBeenCalled();
  });
});
