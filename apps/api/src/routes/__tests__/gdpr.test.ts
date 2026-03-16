import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies — no real DB or security layer needed
// ---------------------------------------------------------------------------
const {
  mockGrantConsent,
  mockRevokeConsent,
  mockGetUserConsents,
  mockHasConsent,
  mockGetStatistics,
  mockRequestDeletion,
  mockGetUserRequests,
  mockGetRequest,
} = vi.hoisted(() => ({
  mockGrantConsent: vi.fn().mockResolvedValue({ id: 'consent-1', type: 'analytics' }),
  mockRevokeConsent: vi.fn().mockResolvedValue(undefined),
  mockGetUserConsents: vi.fn().mockResolvedValue([]),
  mockHasConsent: vi.fn().mockResolvedValue(true),
  mockGetStatistics: vi.fn().mockResolvedValue({ total: 0 }),
  mockRequestDeletion: vi
    .fn()
    .mockResolvedValue({ id: 'del-1', userId: 'user-1', status: 'pending' }),
  mockGetUserRequests: vi.fn().mockResolvedValue([]),
  mockGetRequest: vi.fn().mockResolvedValue(null),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/core/security', () => ({
  createConsentManager: () => ({
    grantConsent: mockGrantConsent,
    revokeConsent: mockRevokeConsent,
    getUserConsents: mockGetUserConsents,
    hasConsent: mockHasConsent,
    getStatistics: mockGetStatistics,
  }),
  createDataDeletionSystem: () => ({
    requestDeletion: mockRequestDeletion,
    getUserRequests: mockGetUserRequests,
    getRequest: mockGetRequest,
  }),
  createDataBreachManager: () => ({}),
}));

vi.mock('../../lib/drizzle-gdpr-storage.js', () => ({
  DrizzleGDPRStorage: class {},
  DrizzleBreachStorage: class {},
}));

import gdprApp from '../gdpr.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

function createApp(user?: UserContext) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) {
      c.set('user' as never, user as never);
    }
    await next();
  });
  app.route('/gdpr', gdprApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ success: false, error: err.message, code: `HTTP_${err.status}` }, err.status);
    }
    return c.json({ success: false, error: 'Internal error' }, 500);
  });
  return app;
}

const testUser: UserContext = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test',
  role: 'user',
};
const adminUser: UserContext = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'admin',
};

function jsonPost(app: Hono, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// biome-ignore lint/suspicious/noExplicitAny: test helper — response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

// ---------------------------------------------------------------------------
// POST /gdpr/consent/grant — Zod validation
// ---------------------------------------------------------------------------

describe('POST /gdpr/consent/grant', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await jsonPost(app, '/gdpr/consent/grant', { type: 'analytics' });
    expect(res.status).toBe(401);
  });

  it('grants consent with valid type', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/consent/grant', { type: 'analytics' });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(mockGrantConsent).toHaveBeenCalledWith('user-1', 'analytics', 'explicit', undefined);
  });

  it('accepts optional expiresIn', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/consent/grant', { type: 'marketing', expiresIn: 86400 });
    expect(res.status).toBe(200);
    expect(mockGrantConsent).toHaveBeenCalledWith('user-1', 'marketing', 'explicit', 86400);
  });

  it('rejects missing type field', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/consent/grant', {});
    expect(res.status).toBe(400);
    // zod-openapi wraps validation errors in { success: false, error: ZodError }
    const body = await parseBody(res);
    expect(body.success).toBe(false);
    expect(body.error.name).toBe('ZodError');
  });

  it('rejects invalid consent type', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/consent/grant', { type: 'tracking' });
    expect(res.status).toBe(400);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
  });

  it('rejects non-integer expiresIn', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/consent/grant', { type: 'analytics', expiresIn: 1.5 });
    expect(res.status).toBe(400);
  });

  it('rejects negative expiresIn', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/consent/grant', { type: 'analytics', expiresIn: -1 });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /gdpr/consent/revoke — Zod validation
// ---------------------------------------------------------------------------

describe('POST /gdpr/consent/revoke', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await jsonPost(app, '/gdpr/consent/revoke', { type: 'analytics' });
    expect(res.status).toBe(401);
  });

  it('revokes consent with valid type', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/consent/revoke', { type: 'analytics' });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
  });

  it('rejects revoking necessary consent', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/consent/revoke', { type: 'necessary' });
    expect(res.status).toBe(400);
    const body = await parseBody(res);
    expect(body.error).toContain('necessary');
  });

  it('rejects missing type', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/consent/revoke', {});
    expect(res.status).toBe(400);
  });

  it('rejects invalid type', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/consent/revoke', { type: 'surveillance' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /gdpr/deletion — Zod validation
// ---------------------------------------------------------------------------

describe('POST /gdpr/deletion', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await jsonPost(app, '/gdpr/deletion', {});
    expect(res.status).toBe(401);
  });

  it('creates deletion request with defaults', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/deletion', {});
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(mockRequestDeletion).toHaveBeenCalledWith('user-1', ['personal'], undefined);
  });

  it('accepts valid categories', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/deletion', { categories: ['personal', 'financial'] });
    expect(res.status).toBe(201);
    expect(mockRequestDeletion).toHaveBeenCalledWith(
      'user-1',
      ['personal', 'financial'],
      undefined,
    );
  });

  it('accepts reason field', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/deletion', { reason: 'Account closure' });
    expect(res.status).toBe(201);
    expect(mockRequestDeletion).toHaveBeenCalledWith('user-1', ['personal'], 'Account closure');
  });

  it('rejects invalid category', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/deletion', { categories: ['biometric'] });
    expect(res.status).toBe(400);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
  });

  it('rejects reason exceeding 1000 chars', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/deletion', { reason: 'x'.repeat(1001) });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET endpoints (no Zod changes, basic coverage)
// ---------------------------------------------------------------------------

describe('GET /gdpr/consent', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await app.request('/gdpr/consent');
    expect(res.status).toBe(401);
  });

  it('returns consents for authenticated user', async () => {
    const app = createApp(testUser);
    const res = await app.request('/gdpr/consent');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.consents)).toBe(true);
  });
});

describe('GET /gdpr/consent/check/:type', () => {
  it('rejects invalid type', async () => {
    const app = createApp(testUser);
    const res = await app.request('/gdpr/consent/check/invalid');
    expect(res.status).toBe(400);
  });

  it('checks valid consent type', async () => {
    const app = createApp(testUser);
    const res = await app.request('/gdpr/consent/check/analytics');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.granted).toBe(true);
  });
});

describe('GET /gdpr/admin/stats', () => {
  it('returns 403 for non-admin', async () => {
    const app = createApp(testUser);
    const res = await app.request('/gdpr/admin/stats');
    expect(res.status).toBe(403);
  });

  it('returns stats for admin', async () => {
    const app = createApp(adminUser);
    const res = await app.request('/gdpr/admin/stats');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
  });
});
