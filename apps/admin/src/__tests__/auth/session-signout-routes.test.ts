/**
 * Session + Sign-Out Route Tests
 *
 * Tests for GET /api/auth/session and POST /api/auth/sign-out.
 * Mocks auth service to test route logic in isolation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks -- must be before route imports
// ---------------------------------------------------------------------------

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: vi.fn((handler: (req: Request) => Promise<Response>) => handler),
}));

vi.mock('@/lib/utils/error-response', () => ({
  createApplicationErrorResponse: vi.fn((message: string, code: string, status: number) => {
    return new Response(JSON.stringify({ error: message, code }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  createErrorResponse: vi.fn((_error: unknown) => {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
}));

import { deleteSession, getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:4000'), {
    method: 'GET',
    headers: { ...headers },
  });
}

function makePostRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:4000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const mockUser = {
  id: 'u1',
  email: 'alice@test.com',
  name: 'Alice',
  avatarUrl: 'https://example.com/avatar.png',
  role: 'admin',
  status: 'active',
  emailVerified: true,
  password: 'hashed-pw',
};

const mockSessionData = {
  user: mockUser,
  session: {
    id: 'sess-123',
    expiresAt: new Date('2026-12-31T00:00:00Z'),
  },
};

// ---------------------------------------------------------------------------
// GET /api/auth/session
// ---------------------------------------------------------------------------

describe('GET /api/auth/session', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../app/api/auth/session/route');
    GET = mod.GET as (req: NextRequest) => Promise<Response>;
  });

  it('returns 401 when no session exists', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const req = makeGetRequest('/api/auth/session');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 with user and session data when authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);

    const req = makeGetRequest('/api/auth/session');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user).toEqual({
      id: 'u1',
      email: 'alice@test.com',
      name: 'Alice',
      avatarUrl: 'https://example.com/avatar.png',
      role: 'admin',
    });
    expect(body.session.id).toBe('sess-123');
    expect(body.session.expiresAt).toBe('2026-12-31T00:00:00.000Z');
  });

  it('passes request headers to getSession', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);

    const req = makeGetRequest('/api/auth/session', {
      cookie: 'revealui-session=tok-abc',
    });
    await GET(req);

    expect(getSession).toHaveBeenCalledTimes(1);
    const passedHeaders = vi.mocked(getSession).mock.calls[0]?.[0];
    expect(passedHeaders).toBeDefined();
  });

  it('returns 500 when getSession throws', async () => {
    vi.mocked(getSession).mockRejectedValue(new Error('DB connection failed'));

    const req = makeGetRequest('/api/auth/session');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it('does not expose password or sensitive fields', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);

    const req = makeGetRequest('/api/auth/session');
    const res = await GET(req);
    const body = await res.json();

    expect(body.user.password).toBeUndefined();
    expect(body.user.status).toBeUndefined();
    expect(body.user.emailVerified).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/sign-out
// ---------------------------------------------------------------------------

describe('POST /api/auth/sign-out', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../app/api/auth/sign-out/route');
    POST = mod.POST as (req: NextRequest) => Promise<Response>;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function deletionCookies(res: Response): string[] {
    return res.headers.getSetCookie().map((cookie) => cookie.toLowerCase());
  }

  it('returns 200 with success on sign-out', async () => {
    vi.mocked(deleteSession).mockResolvedValue(true);

    const req = makePostRequest('/api/auth/sign-out', {
      cookie: 'revealui-session=tok-abc',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('clears the session, role, and must-rotate cookies', async () => {
    vi.mocked(deleteSession).mockResolvedValue(true);

    const req = makePostRequest('/api/auth/sign-out');
    const res = await POST(req);

    const setCookies = deletionCookies(res);
    for (const name of ['revealui-session=', 'revealui-role=', 'revealui-must-rotate=']) {
      const cookie = setCookies.find((entry) => entry.startsWith(name));
      expect(cookie).toBeDefined();
      // Cookie deletion sets max-age=0 with the path the cookies were set with
      expect(cookie).toContain('max-age=0');
      expect(cookie).toContain('path=/');
    }
  });

  it('deletion cookies carry the domain the session cookies were set with', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '.revealui.com');
    vi.mocked(deleteSession).mockResolvedValue(true);

    const res = await POST(makePostRequest('/api/auth/sign-out'));
    const setCookies = deletionCookies(res);

    const sessionCookie = setCookies.find((entry) => entry.startsWith('revealui-session='));
    const roleCookie = setCookies.find((entry) => entry.startsWith('revealui-role='));
    expect(sessionCookie).toContain('domain=.revealui.com');
    expect(roleCookie).toContain('domain=.revealui.com');

    // revealui-must-rotate is set host-only at sign-in; its deletion must stay
    // host-only to match.
    const mustRotateCookie = setCookies.find((entry) => entry.startsWith('revealui-must-rotate='));
    expect(mustRotateCookie).toBeDefined();
    expect(mustRotateCookie).not.toContain('domain=');
  });

  it('omits the domain attribute when SESSION_COOKIE_DOMAIN is unset', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '');
    vi.mocked(deleteSession).mockResolvedValue(true);

    const res = await POST(makePostRequest('/api/auth/sign-out'));
    const setCookies = deletionCookies(res);

    expect(setCookies.length).toBeGreaterThan(0);
    for (const cookie of setCookies) {
      expect(cookie).not.toContain('domain=');
    }
  });

  it('passes request headers to deleteSession', async () => {
    vi.mocked(deleteSession).mockResolvedValue(true);

    const req = makePostRequest('/api/auth/sign-out', {
      cookie: 'revealui-session=tok-xyz',
    });
    await POST(req);

    expect(deleteSession).toHaveBeenCalledTimes(1);
    const passedHeaders = vi.mocked(deleteSession).mock.calls[0]?.[0];
    expect(passedHeaders).toBeDefined();
  });

  it('still succeeds and warns when no session row was deleted', async () => {
    vi.mocked(deleteSession).mockResolvedValue(false);

    const res = await POST(makePostRequest('/api/auth/sign-out'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('clears cookies and returns 200 even when deleteSession throws', async () => {
    vi.mocked(deleteSession).mockRejectedValue(new Error('Storage unavailable'));

    const res = await POST(makePostRequest('/api/auth/sign-out'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(logger.error).toHaveBeenCalledTimes(1);

    const setCookies = deletionCookies(res);
    const sessionCookie = setCookies.find((entry) => entry.startsWith('revealui-session='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('max-age=0');
  });

  it('succeeds even without a session cookie (no-op sign-out)', async () => {
    vi.mocked(deleteSession).mockResolvedValue(false);

    const req = makePostRequest('/api/auth/sign-out');
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(deleteSession).toHaveBeenCalledTimes(1);
  });
});
