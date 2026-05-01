import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies  -  no real DB or security layer needed
// ---------------------------------------------------------------------------
const {
  mockGrantConsent,
  mockRevokeConsent,
  mockGetUserConsents,
  mockHasConsent,
  mockGetStatistics,
  mockRequestDeletion,
  mockProcessDeletion,
  mockGetUserRequests,
  mockGetRequest,
  mockAnonymizeUser,
  mockDeleteAllUserSessions,
  mockGetClient,
} = vi.hoisted(() => ({
  mockGrantConsent: vi.fn().mockResolvedValue({ id: 'consent-1', type: 'analytics' }),
  mockRevokeConsent: vi.fn().mockResolvedValue(undefined),
  mockGetUserConsents: vi.fn().mockResolvedValue([]),
  mockHasConsent: vi.fn().mockResolvedValue(true),
  mockGetStatistics: vi.fn().mockResolvedValue({ total: 0 }),
  mockRequestDeletion: vi
    .fn()
    .mockResolvedValue({ id: 'del-1', userId: 'user-1', status: 'pending' }),
  mockProcessDeletion: vi.fn().mockImplementation(async (_id: string, cb: Function) => {
    await cb('user-1', ['personal']);
  }),
  mockGetUserRequests: vi.fn().mockResolvedValue([]),
  mockGetRequest: vi.fn().mockResolvedValue(null),
  mockAnonymizeUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
  mockDeleteAllUserSessions: vi.fn().mockResolvedValue(undefined),
  mockGetClient: vi.fn().mockReturnValue({}),
}));

vi.mock('@revealui/auth/server', () => ({
  deleteAllUserSessions: mockDeleteAllUserSessions,
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
    processDeletion: mockProcessDeletion,
    getUserRequests: mockGetUserRequests,
    getRequest: mockGetRequest,
  }),
  createDataBreachManager: () => ({}),
}));

vi.mock('@revealui/db', () => ({
  getClient: mockGetClient,
}));

vi.mock('@revealui/db/queries/users', () => ({
  anonymizeUser: mockAnonymizeUser,
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

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

// ---------------------------------------------------------------------------
// POST /gdpr/consent/grant  -  Zod validation
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
// POST /gdpr/consent/revoke  -  Zod validation
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
// POST /gdpr/deletion  -  Zod validation
// ---------------------------------------------------------------------------

describe('POST /gdpr/deletion', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await jsonPost(app, '/gdpr/deletion', {});
    expect(res.status).toBe(401);
  });

  it('creates and processes deletion request with defaults', async () => {
    mockGetRequest.mockResolvedValueOnce({
      id: 'del-1',
      userId: 'user-1',
      status: 'completed',
      deletedData: ['profile', 'email', 'avatar', 'mfa', 'sessions', 'preferences'],
      retainedData: ['billing_records', 'audit_logs'],
    });

    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/deletion', {});
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(mockRequestDeletion).toHaveBeenCalledWith('user-1', ['personal'], undefined);
    expect(mockProcessDeletion).toHaveBeenCalledWith('del-1', expect.any(Function));
    expect(mockAnonymizeUser).toHaveBeenCalled();
    expect(mockDeleteAllUserSessions).toHaveBeenCalledWith('user-1');
  });

  it('accepts valid categories', async () => {
    mockGetRequest.mockResolvedValueOnce({
      id: 'del-1',
      userId: 'user-1',
      status: 'completed',
    });

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
    mockGetRequest.mockResolvedValueOnce({
      id: 'del-1',
      userId: 'user-1',
      status: 'completed',
    });

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

  it('returns processed request with deletion details', async () => {
    const processedRequest = {
      id: 'del-1',
      userId: 'user-1',
      status: 'completed',
      processedAt: '2026-04-10T00:00:00.000Z',
      deletedData: ['profile', 'email', 'avatar', 'mfa', 'sessions', 'preferences'],
      retainedData: ['billing_records', 'audit_logs'],
    };
    mockGetRequest.mockResolvedValueOnce(processedRequest);

    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/deletion', {});
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.request.status).toBe('completed');
    expect(body.request.deletedData).toContain('profile');
    expect(body.request.retainedData).toContain('billing_records');
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
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await app.request('/gdpr/consent/check/analytics');
    expect(res.status).toBe(401);
  });

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

// ---------------------------------------------------------------------------
// GET /gdpr/deletion  -  list user's deletion requests
// ---------------------------------------------------------------------------

describe('GET /gdpr/deletion', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await app.request('/gdpr/deletion');
    expect(res.status).toBe(401);
  });

  it('returns empty list when no requests exist', async () => {
    mockGetUserRequests.mockResolvedValue([]);
    const app = createApp(testUser);
    const res = await app.request('/gdpr/deletion');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.requests).toEqual([]);
    expect(mockGetUserRequests).toHaveBeenCalledWith('user-1');
  });

  it('returns list of deletion requests for authenticated user', async () => {
    const pending = { id: 'del-1', userId: 'user-1', status: 'pending' };
    const completed = { id: 'del-2', userId: 'user-1', status: 'completed' };
    mockGetUserRequests.mockResolvedValue([pending, completed]);

    const app = createApp(testUser);
    const res = await app.request('/gdpr/deletion');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.requests).toHaveLength(2);
    expect(body.requests[0].id).toBe('del-1');
  });

  it('only fetches requests for the authenticated user id', async () => {
    const otherUser = { id: 'other-99', email: null, name: 'Other', role: 'user' };
    mockGetUserRequests.mockResolvedValue([]);

    const app = createApp(otherUser);
    await app.request('/gdpr/deletion');
    expect(mockGetUserRequests).toHaveBeenCalledWith('other-99');
  });
});

// ---------------------------------------------------------------------------
// GET /gdpr/deletion/:id  -  get specific deletion request
// ---------------------------------------------------------------------------

describe('GET /gdpr/deletion/:id', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await app.request('/gdpr/deletion/del-1');
    expect(res.status).toBe(401);
  });

  it('returns 404 when request does not exist', async () => {
    mockGetRequest.mockResolvedValue(null);
    const app = createApp(testUser);
    const res = await app.request('/gdpr/deletion/del-missing');
    expect(res.status).toBe(404);
  });

  it('returns 404 when request belongs to a different user', async () => {
    mockGetRequest.mockResolvedValue({ id: 'del-1', userId: 'other-user', status: 'pending' });
    const app = createApp(testUser);
    const res = await app.request('/gdpr/deletion/del-1');
    expect(res.status).toBe(404);
  });

  it('returns the deletion request when it belongs to the authenticated user', async () => {
    const req = { id: 'del-1', userId: 'user-1', status: 'pending' };
    mockGetRequest.mockResolvedValue(req);

    const app = createApp(testUser);
    const res = await app.request('/gdpr/deletion/del-1');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.request.id).toBe('del-1');
    expect(mockGetRequest).toHaveBeenCalledWith('del-1');
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
