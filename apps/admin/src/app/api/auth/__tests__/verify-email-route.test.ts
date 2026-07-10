/**
 * Tests for GET /api/auth/verify-email
 *
 * Email verification via hashed token comparison. On a valid, unexpired,
 * single-use token, establishes a session immediately (mirroring sign-up's
 * auto-promoted first-user path) and redirects to the resolved destination
 * (billing checkout when `?upgrade=` is present, `/welcome` or `/` otherwise).
 * Every other path  -  expired, reused, garbage, or already-verified token  -
 * must never create a session. Rate limited by IP, fails closed if the rate
 * limit store is unavailable.
 */

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckRateLimit = vi.fn();
const mockCreateSession = vi.fn();
const mockGetUserByVerificationToken = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  createSession: (...args: unknown[]) => mockCreateSession(...args),
}));

vi.mock('@revealui/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({})),
}));

vi.mock('@revealui/db/queries/users', () => ({
  getUserByVerificationToken: (...args: unknown[]) => mockGetUserByVerificationToken(...args),
  updateUser: (...args: unknown[]) => mockUpdateUser(...args),
}));

vi.mock('next/server', () => {
  class MockCookies {
    private store = new Map<string, { value: string; options: Record<string, unknown> }>();
    set(name: string, value: string, options?: Record<string, unknown>) {
      this.store.set(name, { value, options: options ?? {} });
    }
    get(name: string) {
      return this.store.get(name);
    }
    has(name: string) {
      return this.store.has(name);
    }
  }
  class MockNextResponse {
    body: unknown;
    status: number;
    cookies: MockCookies;
    url?: string;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.cookies = new MockCookies();
    }
    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(data, init);
    }
    static redirect(url: string | URL, _status = 307) {
      const res = new MockNextResponse(null, { status: 307 });
      res.url = typeof url === 'string' ? url : url.toString();
      return res;
    }
  }
  return { NextResponse: MockNextResponse };
});

type MockRes = {
  status: number;
  url?: string;
  cookies: {
    get: (n: string) => { value: string; options: Record<string, unknown> } | undefined;
    has: (n: string) => boolean;
  };
};

function makeRequest(token?: string, upgrade?: string) {
  const url = new URL('http://localhost:4000/api/auth/verify-email');
  if (token) url.searchParams.set('token', token);
  if (upgrade) url.searchParams.set('upgrade', upgrade);
  return {
    headers: {
      get: (key: string) => {
        if (key === 'x-forwarded-for') return '10.0.0.1';
        if (key === 'user-agent') return 'vitest';
        return null;
      },
    },
    nextUrl: url,
  } as never;
}

function makeRequestWithHeaders(token: string, headers: Record<string, string>) {
  const url = new URL('http://localhost:4000/api/auth/verify-email');
  url.searchParams.set('token', token);
  return {
    headers: { get: (key: string) => headers[key] ?? null },
    nextUrl: url,
  } as never;
}

describe('GET /api/auth/verify-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
    });
  });

  async function loadRoute() {
    const mod = await import('../verify-email/route.js');
    return mod.GET;
  }

  it('redirects with missing_token when no token param', async () => {
    const GET = await loadRoute();
    const res = await GET(makeRequest());
    expect((res as MockRes).url).toContain('error=missing_token');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('redirects with too_many_attempts when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });

    const GET = await loadRoute();
    const res = await GET(makeRequest('some-token'));
    expect((res as MockRes).url).toContain('error=too_many_attempts');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('fails closed  -  redirects with error when rate limit check throws', async () => {
    mockCheckRateLimit.mockRejectedValue(new Error('Redis unavailable'));

    const GET = await loadRoute();
    const res = await GET(makeRequest('some-token'));
    expect((res as MockRes).url).toContain('error=verification_failed');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('garbage token: redirects with invalid_token and creates no session', async () => {
    mockGetUserByVerificationToken.mockResolvedValue(null);

    const GET = await loadRoute();
    const res = await GET(makeRequest('garbage-token'));
    expect((res as MockRes).url).toContain('error=invalid_token');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('expired token: getUserByVerificationToken finds no row, redirects with invalid_token and creates no session', async () => {
    // The query's WHERE clause excludes expired tokens, so an expired token
    // surfaces identically to a garbage one  -  no matching row.
    mockGetUserByVerificationToken.mockResolvedValue(null);

    const GET = await loadRoute();
    const res = await GET(makeRequest('expired-token'));
    expect((res as MockRes).url).toContain('error=invalid_token');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('reused token: the token column is nulled after first use, so a second attempt finds no row and creates no session', async () => {
    mockGetUserByVerificationToken.mockResolvedValue(null);

    const GET = await loadRoute();
    const res = await GET(makeRequest('already-consumed-token'));
    expect((res as MockRes).url).toContain('error=invalid_token');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('redirects with already_verified when email already verified, and creates no session', async () => {
    mockGetUserByVerificationToken.mockResolvedValue({ id: 'u1', emailVerified: true });

    const GET = await loadRoute();
    const res = await GET(makeRequest('valid-token'));
    expect((res as MockRes).url).toContain('message=already_verified');
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('fails closed when updateUser returns no row, and creates no session', async () => {
    mockGetUserByVerificationToken.mockResolvedValue({ id: 'u1', emailVerified: false });
    mockUpdateUser.mockResolvedValue(null);

    const GET = await loadRoute();
    const res = await GET(makeRequest('valid-token'));
    expect((res as MockRes).url).toContain('error=verification_failed');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('valid token: establishes a session, sets cookies, and redirects to billing checkout with the upgrade param', async () => {
    mockGetUserByVerificationToken.mockResolvedValue({ id: 'u1', emailVerified: false });
    mockUpdateUser.mockResolvedValue({ id: 'u1', role: 'viewer', emailVerified: true });
    mockCreateSession.mockResolvedValue({
      token: 'session-token-abc',
      session: { id: 'sess1', userId: 'u1' },
    });

    const GET = await loadRoute();
    const res = await GET(makeRequest('valid-token', 'pro'));

    expect(mockCreateSession).toHaveBeenCalledWith('u1', expect.any(Object));
    expect((res as MockRes).url).toContain('/account/billing?upgrade=pro');
    expect((res as MockRes).cookies.get('revealui-session')?.value).toBe('session-token-abc');
    expect((res as MockRes).cookies.get('revealui-role')?.value).toBe('viewer');
  });

  it('valid token without an upgrade param: redirects a non-admin to /welcome', async () => {
    mockGetUserByVerificationToken.mockResolvedValue({ id: 'u1', emailVerified: false });
    mockUpdateUser.mockResolvedValue({ id: 'u1', role: 'viewer', emailVerified: true });
    mockCreateSession.mockResolvedValue({
      token: 'session-token-xyz',
      session: { id: 'sess2', userId: 'u1' },
    });

    const GET = await loadRoute();
    const res = await GET(makeRequest('valid-token'));

    expect((res as MockRes).url).toContain('/welcome');
    expect((res as MockRes).cookies.has('revealui-session')).toBe(true);
  });

  it('valid token for an admin without an upgrade param: redirects to /', async () => {
    mockGetUserByVerificationToken.mockResolvedValue({ id: 'u2', emailVerified: false });
    mockUpdateUser.mockResolvedValue({ id: 'u2', role: 'admin', emailVerified: true });
    mockCreateSession.mockResolvedValue({
      token: 'session-token-admin',
      session: { id: 'sess3', userId: 'u2' },
    });

    const GET = await loadRoute();
    const res = await GET(makeRequest('valid-token'));

    expect((res as MockRes).url).toMatch(/\/$/);
    expect((res as MockRes).cookies.get('revealui-role')?.value).toBe('admin');
  });

  it('ignores an unrecognized upgrade value (no open redirect)', async () => {
    mockGetUserByVerificationToken.mockResolvedValue({ id: 'u1', emailVerified: false });
    mockUpdateUser.mockResolvedValue({ id: 'u1', role: 'viewer', emailVerified: true });
    mockCreateSession.mockResolvedValue({
      token: 'session-token-abc',
      session: { id: 'sess1', userId: 'u1' },
    });

    const GET = await loadRoute();
    const res = await GET(makeRequest('valid-token', 'enterprise'));

    expect((res as MockRes).url).toContain('/welcome');
    expect((res as MockRes).url).not.toContain('enterprise');
  });

  it('redirects with error on unexpected DB failure, and creates no session', async () => {
    mockGetUserByVerificationToken.mockRejectedValue(new Error('DB connection lost'));

    const GET = await loadRoute();
    const res = await GET(makeRequest('some-token'));
    expect((res as MockRes).url).toContain('error=verification_failed');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('hashes the raw token with SHA-256 before the DB lookup, never passing it through verbatim', async () => {
    const rawToken = 'my-secret-token';
    const expectedHash = createHash('sha256').update(rawToken).digest('hex');
    mockGetUserByVerificationToken.mockResolvedValue(null);

    const GET = await loadRoute();
    await GET(makeRequest(rawToken));

    expect(mockGetUserByVerificationToken).toHaveBeenCalledWith(expect.anything(), expectedHash);
    expect(mockGetUserByVerificationToken).not.toHaveBeenCalledWith(expect.anything(), rawToken);
  });

  it('marks the email verified and consumes the token in a single update', async () => {
    mockGetUserByVerificationToken.mockResolvedValue({ id: 'u1', emailVerified: false });
    mockUpdateUser.mockResolvedValue({ id: 'u1', role: 'viewer', emailVerified: true });
    mockCreateSession.mockResolvedValue({
      token: 'session-token-abc',
      session: { id: 'sess1', userId: 'u1' },
    });

    const GET = await loadRoute();
    await GET(makeRequest('valid-token'));

    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateUser).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      expect.objectContaining({
        emailVerified: true,
        emailVerificationToken: null,
      }),
    );
  });

  it('rate-limit key uses only the first x-forwarded-for hop', async () => {
    mockGetUserByVerificationToken.mockResolvedValue(null);

    const GET = await loadRoute();
    await GET(makeRequestWithHeaders('some-token', { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }));

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'verify_email:1.2.3.4',
      expect.objectContaining({ maxAttempts: 10, windowMs: 15 * 60 * 1000 }),
    );
  });

  it('rate-limit key prefers x-real-ip over x-forwarded-for', async () => {
    mockGetUserByVerificationToken.mockResolvedValue(null);

    const GET = await loadRoute();
    await GET(
      makeRequestWithHeaders('some-token', {
        'x-real-ip': '10.9.8.7',
        'x-forwarded-for': '1.2.3.4',
      }),
    );

    expect(mockCheckRateLimit).toHaveBeenCalledWith('verify_email:10.9.8.7', expect.any(Object));
  });

  it('rate-limit key falls back to "unknown" when no IP headers are present', async () => {
    mockGetUserByVerificationToken.mockResolvedValue(null);

    const GET = await loadRoute();
    await GET(makeRequestWithHeaders('some-token', {}));

    expect(mockCheckRateLimit).toHaveBeenCalledWith('verify_email:unknown', expect.any(Object));
  });
});
