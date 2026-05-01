/**
 * GDPR Route  -  Edge Case Tests
 *
 * Supplements gdpr.test.ts with:
 * - Consent grant: expiresIn:0 fails positive() → 400
 * - Consent grant: necessary type is allowed at grant level (only revoke is blocked)
 * - Consent check: hasConsent returns false → granted:false in response
 * - Consent check: all 5 valid types pass path param validation
 * - Deletion: reason at exactly 1000 chars → 201 (max boundary)
 * - Deletion: empty categories array [] passed as-is (no ?? ['personal'] override)
 * - Deletion: all 5 valid categories in one request
 * - Admin stats: unauthenticated request (no user context) → 403
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks  -  must come before imports
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
    if (user) c.set('user' as never, user as never);
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

function jsonPost(app: Hono, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const testUser: UserContext = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test',
  role: 'user',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGrantConsent.mockResolvedValue({ id: 'consent-1', type: 'analytics' });
  mockRequestDeletion.mockResolvedValue({ id: 'del-1', userId: 'user-1', status: 'pending' });
  mockProcessDeletion.mockImplementation(async (_id: string, cb: Function) => {
    await cb('user-1', ['personal']);
  });
  mockGetRequest.mockResolvedValue({
    id: 'del-1',
    userId: 'user-1',
    status: 'completed',
  });
  mockAnonymizeUser.mockResolvedValue({ id: 'user-1' });
  mockHasConsent.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /gdpr/consent/grant  -  expiresIn boundary', () => {
  it('returns 400 when expiresIn is 0 (positive() requires > 0)', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/consent/grant', { type: 'analytics', expiresIn: 0 });
    expect(res.status).toBe(400);
  });

  it('allows granting necessary consent (only revoke is blocked at the route level)', async () => {
    // The route only blocks revoking necessary consent; granting it is allowed.
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/consent/grant', { type: 'necessary' });
    expect(res.status).toBe(200);
    expect(mockGrantConsent).toHaveBeenCalledWith('user-1', 'necessary', 'explicit', undefined);
  });

  it('grants consent for all 5 consent types', async () => {
    const types = ['necessary', 'functional', 'analytics', 'marketing', 'personalization'] as const;
    for (const type of types) {
      const app = createApp(testUser);
      const res = await jsonPost(app, '/gdpr/consent/grant', { type });
      expect(res.status).toBe(200);
    }
  });
});

describe('GET /gdpr/consent/check/:type  -  hasConsent result', () => {
  it('returns granted:false when hasConsent returns false', async () => {
    mockHasConsent.mockResolvedValue(false);
    const app = createApp(testUser);
    const res = await app.request('/gdpr/consent/check/marketing');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.granted).toBe(false);
    expect(body.type).toBe('marketing');
  });

  it('accepts all 5 valid consent types as path params', async () => {
    const types = ['necessary', 'functional', 'analytics', 'marketing', 'personalization'];
    for (const type of types) {
      const app = createApp(testUser);
      const res = await app.request(`/gdpr/consent/check/${type}`);
      expect(res.status).toBe(200);
    }
  });
});

describe('POST /gdpr/deletion  -  boundary and category validation', () => {
  it('returns 201 when reason is exactly 1000 characters (max boundary)', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/deletion', { reason: 'x'.repeat(1000) });
    expect(res.status).toBe(201);
  });

  it('passes empty categories array as-is to requestDeletion (no ?? override for [])', async () => {
    // The route uses: body.categories ?? ['personal']
    // An empty array [] is not null/undefined  -  it IS a value  -  so it is passed as-is.
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/deletion', { categories: [] });
    expect(res.status).toBe(201);
    expect(mockRequestDeletion).toHaveBeenCalledWith('user-1', [], undefined);
  });

  it('accepts all 5 valid deletion categories in a single request', async () => {
    const app = createApp(testUser);
    const res = await jsonPost(app, '/gdpr/deletion', {
      categories: ['personal', 'sensitive', 'financial', 'health', 'behavioral'],
      reason: 'Account closure  -  all data',
    });
    expect(res.status).toBe(201);
    expect(mockRequestDeletion).toHaveBeenCalledWith(
      'user-1',
      ['personal', 'sensitive', 'financial', 'health', 'behavioral'],
      'Account closure  -  all data',
    );
  });
});

describe('GET /gdpr/admin/stats  -  auth', () => {
  it('returns 403 when no user context is set (unauthenticated)', async () => {
    // createApp() with no user  -  user context is undefined
    const app = createApp();
    const res = await app.request('/gdpr/admin/stats');
    expect(res.status).toBe(403);
  });
});
