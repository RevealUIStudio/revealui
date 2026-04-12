/**
 * Tests for GET /api/auth/verify-email
 *
 * Email verification via hashed token comparison. All paths redirect.
 * Rate limited by IP, fails closed if rate limit store is unavailable.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckRateLimit = vi.fn();
const mockGetUserByVerificationToken = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
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
  class MockNextResponse {
    body: unknown;
    status: number;
    url?: string;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
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

function makeRequest(token?: string) {
  const url = new URL('http://localhost:4000/api/auth/verify-email');
  if (token) url.searchParams.set('token', token);
  return {
    headers: {
      get: (key: string) => {
        if (key === 'x-forwarded-for') return '10.0.0.1';
        return null;
      },
    },
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
    expect((res as { url: string }).url).toContain('error=missing_token');
  });

  it('redirects with too_many_attempts when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });

    const GET = await loadRoute();
    const res = await GET(makeRequest('some-token'));
    expect((res as { url: string }).url).toContain('error=too_many_attempts');
  });

  it('fails closed  -  redirects with error when rate limit check throws', async () => {
    mockCheckRateLimit.mockRejectedValue(new Error('Redis unavailable'));

    const GET = await loadRoute();
    const res = await GET(makeRequest('some-token'));
    expect((res as { url: string }).url).toContain('error=verification_failed');
  });

  it('redirects with invalid_token when no matching user found', async () => {
    mockGetUserByVerificationToken.mockResolvedValue(null);

    const GET = await loadRoute();
    const res = await GET(makeRequest('bad-token'));
    expect((res as { url: string }).url).toContain('error=invalid_token');
  });

  it('redirects with already_verified when email already verified', async () => {
    mockGetUserByVerificationToken.mockResolvedValue({ id: 'u1', emailVerified: true });

    const GET = await loadRoute();
    const res = await GET(makeRequest('valid-token'));
    expect((res as { url: string }).url).toContain('message=already_verified');
  });

  it('verifies email and redirects with success message', async () => {
    mockGetUserByVerificationToken.mockResolvedValue({ id: 'u1', emailVerified: false });
    mockUpdateUser.mockResolvedValue(null);

    const GET = await loadRoute();
    const res = await GET(makeRequest('valid-token'));
    expect((res as { url: string }).url).toContain('message=email_verified');
  });

  it('redirects with error on unexpected DB failure', async () => {
    mockGetUserByVerificationToken.mockRejectedValue(new Error('DB connection lost'));

    const GET = await loadRoute();
    const res = await GET(makeRequest('some-token'));
    expect((res as { url: string }).url).toContain('error=verification_failed');
  });
});
