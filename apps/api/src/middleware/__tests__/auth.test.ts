import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  errorEvents: Symbol('errorEvents'),
}));

import { getSession } from '@revealui/auth/server';
import { authMiddleware, requireRole } from '../auth.js';
import { errorHandler } from '../error.js';

const mockedGetSession = vi.mocked(getSession);

function mockSession(
  overrides?: Partial<{ user: Record<string, unknown>; session: Record<string, unknown> }>,
  // biome-ignore lint/suspicious/noExplicitAny: test helper  -  mock session data with partial fields
): any {
  return {
    user: { id: 'user-1', role: 'admin', email: 'a@b.com', ...overrides?.user },
    session: { id: 'sess-1', expiresAt: new Date(), ...overrides?.session },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  Hono Variables type requires loose typing in tests
type TestVariables = { user: any; session: any };

// ---------------------------------------------------------------------------
// Tests  -  authMiddleware
// ---------------------------------------------------------------------------
describe('authMiddleware', () => {
  describe('required: true (default)', () => {
    it('sets user and session when session exists', async () => {
      mockedGetSession.mockResolvedValue(mockSession());

      const app = new Hono<{ Variables: TestVariables }>();
      app.use('*', authMiddleware());
      app.get('/test', (c) =>
        c.json({ userId: c.get('user')?.id, sessionId: c.get('session')?.id }),
      );

      const res = await app.request('/test');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.userId).toBe('user-1');
      expect(body.sessionId).toBe('sess-1');
    });

    it('returns 401 when no session exists', async () => {
      mockedGetSession.mockResolvedValue(null);

      const app = new Hono<{ Variables: TestVariables }>();
      app.use('*', authMiddleware());
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test');

      expect(res.status).toBe(401);
    });

    it('returns 401 with error message when no session exists', async () => {
      mockedGetSession.mockResolvedValue(null);

      const app = new Hono<{ Variables: TestVariables }>();
      app.use('*', authMiddleware({ required: true }));
      app.get('/test', (c) => c.json({ ok: true }));
      app.onError(errorHandler);

      const res = await app.request('/test');

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Authentication required');
    });

    it('passes request headers to getSession', async () => {
      mockedGetSession.mockResolvedValue(
        mockSession({ user: { id: 'u1' }, session: { id: 's1' } }),
      );

      const app = new Hono<{ Variables: TestVariables }>();
      app.use('*', authMiddleware({ required: false }));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test', {
        headers: { cookie: 'revealui-session=abc123' },
      });

      expect(mockedGetSession).toHaveBeenCalledOnce();
      const passedHeaders = mockedGetSession.mock.calls[0]![0];
      expect(passedHeaders).toBeInstanceOf(Headers);
    });
  });

  describe('required: false (optional auth)', () => {
    it('sets user and session when session exists', async () => {
      mockedGetSession.mockResolvedValue(
        mockSession({
          user: { id: 'user-2', role: 'editor', email: 'b@c.com' },
          session: { id: 'sess-2' },
        }),
      );

      const app = new Hono<{ Variables: TestVariables }>();
      app.use('*', authMiddleware({ required: false }));
      app.get('/test', (c) => c.json({ userId: c.get('user')?.id ?? null }));

      const res = await app.request('/test');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.userId).toBe('user-2');
    });

    it('allows unauthenticated requests through without setting user', async () => {
      mockedGetSession.mockResolvedValue(null);

      const app = new Hono<{ Variables: TestVariables }>();
      app.use('*', authMiddleware({ required: false }));
      app.get('/test', (c) => c.json({ userId: c.get('user') ?? null }));

      const res = await app.request('/test');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.userId).toBeNull();
    });
  });

  it('calls next() after setting context', async () => {
    mockedGetSession.mockResolvedValue(mockSession());

    const nextSpy = vi.fn();
    const app = new Hono<{ Variables: TestVariables }>();
    app.use('*', authMiddleware());
    app.use('*', async (_c, next) => {
      nextSpy();
      await next();
    });
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test');

    expect(nextSpy).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Tests  -  requireRole
// ---------------------------------------------------------------------------
describe('requireRole', () => {
  function createApp(...roles: string[]) {
    const app = new Hono<{ Variables: TestVariables }>();
    app.use('*', authMiddleware());
    app.use('*', requireRole(...roles));
    app.get('/test', (c) => c.json({ ok: true }));
    return app;
  }

  it('allows user with matching role', async () => {
    mockedGetSession.mockResolvedValue(mockSession());

    const app = createApp('admin', 'editor');
    const res = await app.request('/test');

    expect(res.status).toBe(200);
  });

  it('returns 403 when user role is not in allowed list', async () => {
    mockedGetSession.mockResolvedValue(mockSession({ user: { role: 'viewer' } }));

    const app = createApp('admin', 'editor');
    const res = await app.request('/test');

    expect(res.status).toBe(403);
  });

  it('returns 401 when no user is set', async () => {
    const app = new Hono<{ Variables: TestVariables }>();
    // Skip auth middleware  -  no user set
    app.use('*', requireRole('admin'));
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');

    expect(res.status).toBe(401);
  });

  it('accepts single role', async () => {
    mockedGetSession.mockResolvedValue(mockSession({ user: { role: 'editor' } }));

    const app = createApp('editor');
    const res = await app.request('/test');

    expect(res.status).toBe(200);
  });

  it('checks exact role match (no partial matching)', async () => {
    mockedGetSession.mockResolvedValue(mockSession({ user: { role: 'admin-viewer' } }));

    const app = createApp('admin');
    const res = await app.request('/test');

    expect(res.status).toBe(403);
  });
});
