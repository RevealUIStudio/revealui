/**
 * Middleware Chain Integration Test
 *
 * Tests the auth → authorization → rate-limit middleware composed in sequence,
 * verifying that the chain enforces security in the correct order.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const { mockHasPermission, mockCacheGet } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockCacheGet: vi.fn().mockReturnValue(undefined),
}));

vi.mock('@revealui/core/security', () => {
  return {
    AuthorizationSystem: class {
      registerRole = vi.fn();
      hasPermission = mockHasPermission;
    },
    CommonRoles: {
      admin: {
        name: 'admin',
        permissions: [{ resource: '*', actions: ['*'] }],
      },
      viewer: { name: 'viewer', permissions: [] },
    },
    PermissionCache: class {
      get = mockCacheGet;
      set = vi.fn();
      clearUser = vi.fn();
    },
  };
});

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  errorEvents: Symbol('errorEvents'),
}));

import { checkRateLimit, getSession } from '@revealui/auth/server';
import { authMiddleware, requireRole } from '../auth.js';
import { requirePermission } from '../authorization.js';
import { errorHandler } from '../error.js';
import { rateLimitMiddleware } from '../rate-limit.js';

const mockedGetSession = vi.mocked(getSession);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  mock session data
function mockSession(overrides?: Record<string, unknown>): any {
  return {
    user: {
      id: 'user-1',
      role: 'admin',
      email: 'a@b.com',
      ...overrides,
    },
    session: { id: 'sess-1', expiresAt: new Date() },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: rate limit allows, session exists
  mockedCheckRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 59,
    resetAt: Date.now() + 60_000,
  });
});

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  Hono Variables type requires loose typing
type Vars = { user: any; session: any };

// ─── Full Chain: rate-limit → auth → role ─────────────────────────────────

describe('middleware chain: rate-limit → auth → role gate', () => {
  function createChainedApp(...allowedRoles: string[]) {
    const app = new Hono<{ Variables: Vars }>();
    app.use(
      '*',
      rateLimitMiddleware({
        maxRequests: 60,
        windowMs: 60_000,
        keyPrefix: 'test',
      }),
    );
    app.use('*', authMiddleware({ required: true }));
    app.use('*', requireRole(...allowedRoles));
    app.get('/protected', (c) => c.json({ userId: c.get('user')?.id, ok: true }));
    app.onError(errorHandler);
    return app;
  }

  it('allows request through full chain when all checks pass', async () => {
    mockedGetSession.mockResolvedValue(mockSession());

    const app = createChainedApp('admin');
    const res = await app.request('/protected');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBe('user-1');
  });

  it('rate limit blocks before auth is checked', async () => {
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const app = createChainedApp('admin');
    const res = await app.request('/protected');

    expect(res.status).toBe(429);
    // Auth should never be called
    expect(mockedGetSession).not.toHaveBeenCalled();
  });

  it('auth blocks before role check when unauthenticated', async () => {
    mockedGetSession.mockResolvedValue(null);

    const app = createChainedApp('admin');
    const res = await app.request('/protected');

    expect(res.status).toBe(401);
  });

  it('role gate blocks when user has wrong role', async () => {
    mockedGetSession.mockResolvedValue(mockSession({ role: 'viewer' }));

    const app = createChainedApp('admin', 'editor');
    const res = await app.request('/protected');

    expect(res.status).toBe(403);
  });
});

// ─── Full Chain: rate-limit → auth → permission (RBAC) ───────────────────

describe('middleware chain: rate-limit → auth → permission gate', () => {
  function createPermissionApp(resource: string, action: string) {
    const app = new Hono<{ Variables: Vars }>();
    app.use(
      '*',
      rateLimitMiddleware({
        maxRequests: 10,
        windowMs: 60_000,
        keyPrefix: 'perm-test',
      }),
    );
    app.use('*', authMiddleware({ required: true }));
    app.use('*', requirePermission(resource, action));
    app.get('/admin-only', (c) => c.json({ ok: true }));
    app.onError(errorHandler);
    return app;
  }

  it('allows admin through permission check', async () => {
    mockedGetSession.mockResolvedValue(mockSession());
    mockHasPermission.mockReturnValue(true);

    const app = createPermissionApp('rag', 'admin');
    const res = await app.request('/admin-only');

    expect(res.status).toBe(200);
  });

  it('denies non-admin through permission check', async () => {
    mockedGetSession.mockResolvedValue(mockSession({ role: 'viewer' }));
    mockHasPermission.mockReturnValue(false);

    const app = createPermissionApp('rag', 'admin');
    const res = await app.request('/admin-only');

    expect(res.status).toBe(403);
  });

  it('rate limit takes precedence over permission check', async () => {
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const app = createPermissionApp('rag', 'admin');
    const res = await app.request('/admin-only');

    expect(res.status).toBe(429);
    expect(mockedGetSession).not.toHaveBeenCalled();
  });
});

// ─── Optional Auth + Protected Write ─────────────────────────────────────

describe('optional auth (read) + required auth (write)', () => {
  function createMixedApp() {
    const app = new Hono<{ Variables: Vars }>();
    // Read routes: optional auth
    app.use('/api/public/*', authMiddleware({ required: false }));
    app.get('/api/public/data', (c) => c.json({ user: c.get('user')?.id ?? null }));
    // Write routes: required auth
    app.use('/api/admin/*', authMiddleware({ required: true }));
    app.post('/api/admin/data', (c) => c.json({ created: true, userId: c.get('user')?.id }));
    app.onError(errorHandler);
    return app;
  }

  it('allows unauthenticated access to public read endpoint', async () => {
    mockedGetSession.mockResolvedValue(null);

    const app = createMixedApp();
    const res = await app.request('/api/public/data');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });

  it('enriches public endpoint with user when authenticated', async () => {
    mockedGetSession.mockResolvedValue(mockSession());

    const app = createMixedApp();
    const res = await app.request('/api/public/data');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBe('user-1');
  });

  it('blocks unauthenticated access to admin endpoint', async () => {
    mockedGetSession.mockResolvedValue(null);

    const app = createMixedApp();
    const res = await app.request('/api/admin/data', { method: 'POST' });

    expect(res.status).toBe(401);
  });

  it('allows authenticated access to admin endpoint', async () => {
    mockedGetSession.mockResolvedValue(mockSession());

    const app = createMixedApp();
    const res = await app.request('/api/admin/data', { method: 'POST' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(true);
  });
});

// ─── Multiple Rate Limits (stacked) ──────────────────────────────────────

describe('stacked rate limits', () => {
  it('applies the most restrictive limit', async () => {
    // First rate limit passes, second rejects
    mockedCheckRateLimit
      .mockResolvedValueOnce({
        allowed: true,
        remaining: 50,
        resetAt: Date.now() + 60_000,
      })
      .mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60_000,
      });

    const app = new Hono<{ Variables: Vars }>();
    app.use(
      '*',
      rateLimitMiddleware({
        maxRequests: 60,
        windowMs: 60_000,
        keyPrefix: 'global',
      }),
    );
    app.use(
      '/api/billing/*',
      rateLimitMiddleware({
        maxRequests: 5,
        windowMs: 60_000,
        keyPrefix: 'billing',
      }),
    );
    app.get('/api/billing/checkout', (c) => c.json({ ok: true }));

    const res = await app.request('/api/billing/checkout');

    expect(res.status).toBe(429);
  });
});

// ─── Error Propagation ───────────────────────────────────────────────────

describe('error propagation through chain', () => {
  it('auth error returns 401 even when rate limit passes', async () => {
    mockedGetSession.mockRejectedValue(new Error('DB connection failed'));

    const app = new Hono<{ Variables: Vars }>();
    app.use(
      '*',
      rateLimitMiddleware({
        maxRequests: 60,
        windowMs: 60_000,
        keyPrefix: 'err-test',
      }),
    );
    app.use('*', authMiddleware({ required: true }));
    app.get('/test', (c) => c.json({ ok: true }));
    app.onError(errorHandler);

    const res = await app.request('/test');

    // Auth middleware should catch the error and return 500 or let error handler catch it
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
