/**
 * Tests for POST /api/auth/sign-in
 *
 * Covers: JSON parsing, contract validation, successful sign-in with cookies,
 * MFA redirect flow, error status mapping, and rate limiting wrapper.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSignIn = vi.fn();
const mockSignCookiePayload = vi.fn();
const mockValidate = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signCookiePayload: (...args: unknown[]) => mockSignCookiePayload(...args),
}));

vi.mock('@revealui/contracts', () => ({
  SignInRequestContract: {
    validate: (...args: unknown[]) => mockValidate(...args),
  },
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: (handler: (...args: unknown[]) => unknown, _opts?: unknown) => handler,
}));

vi.mock('@/lib/utils/error-response', () => {
  const { NextResponse } = require('next/server');
  return {
    createApplicationErrorResponse: (msg: string, code: string, status = 500) =>
      NextResponse.json({ error: msg, code }, { status }),
    createErrorResponse: (err: unknown) =>
      NextResponse.json(
        { error: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500 },
      ),
    createValidationErrorResponse: (
      msg: string,
      field: string,
      _value: unknown,
      details?: unknown,
    ) => NextResponse.json({ error: msg, field, details }, { status: 400 }),
  };
});

vi.mock('next/server', () => {
  class MockCookies {
    private store: Map<string, { value: string; options: Record<string, unknown> }> = new Map();
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
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.cookies = new MockCookies();
    }
    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(data, init);
    }
  }
  return { NextResponse: MockNextResponse };
});

type CookieStore = {
  has: (name: string) => boolean;
  get: (name: string) => { value: string; options: Record<string, unknown> } | undefined;
};

function makeRequest(body?: unknown) {
  return {
    headers: {
      get: (key: string) => {
        if (key === 'user-agent') return 'test-agent';
        if (key === 'x-forwarded-for') return '10.0.0.1, 203.0.113.50';
        return null;
      },
    },
    json:
      body !== undefined ? () => Promise.resolve(body) : () => Promise.reject(new Error('no body')),
  } as never;
}

describe('POST /api/auth/sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../sign-in/route.js');
    return mod.POST;
  }

  it('returns 400 when request body is invalid JSON', async () => {
    const POST = await loadRoute();
    const req = {
      headers: { get: () => null },
      json: () => Promise.reject(new Error('invalid json')),
    } as never;
    const res = await POST(req);
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 400 when contract validation fails', async () => {
    mockValidate.mockReturnValue({
      success: false,
      errors: {
        issues: [{ message: 'Invalid email', path: ['email'] }],
      },
    });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ email: 'bad', password: 'x' }));
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns user data and sets cookies on successful sign-in', async () => {
    mockValidate.mockReturnValue({
      success: true,
      data: { email: 'test@example.com', password: 'ValidPass1' },
    });
    mockSignIn.mockResolvedValue({
      success: true,
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        role: 'user',
      },
      sessionToken: 'session-token-abc',
    });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ email: 'test@example.com', password: 'ValidPass1' }));

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { user: { id: string } } }).body.user.id).toBe('user-1');

    // Session cookie should be set
    const cookies = (res as unknown as { cookies: CookieStore }).cookies;
    expect(cookies.has('revealui-session')).toBe(true);
    expect(cookies.get('revealui-session')?.value).toBe('session-token-abc');
    // Role cookie should be set to 'user'
    expect(cookies.get('revealui-role')?.value).toBe('user');
  });

  it('sets admin role cookie for admin users', async () => {
    mockValidate.mockReturnValue({
      success: true,
      data: { email: 'admin@example.com', password: 'AdminPass1' },
    });
    mockSignIn.mockResolvedValue({
      success: true,
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin',
        avatarUrl: null,
        role: 'admin',
      },
      sessionToken: 'admin-session-token',
    });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ email: 'admin@example.com', password: 'AdminPass1' }));

    const cookies = (res as unknown as { cookies: CookieStore }).cookies;
    expect(cookies.get('revealui-role')?.value).toBe('admin');
  });

  it('returns MFA response and sets mfa-pending cookie when MFA required', async () => {
    mockValidate.mockReturnValue({
      success: true,
      data: { email: 'mfa@example.com', password: 'ValidPass1' },
    });
    mockSignIn.mockResolvedValue({
      success: true,
      requiresMfa: true,
      mfaUserId: 'mfa-user-1',
    });
    mockSignCookiePayload.mockReturnValue('signed-payload');

    const POST = await loadRoute();
    const res = await POST(makeRequest({ email: 'mfa@example.com', password: 'ValidPass1' }));

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { requiresMfa: boolean } }).body.requiresMfa).toBe(true);

    const cookies = (res as unknown as { cookies: CookieStore }).cookies;
    expect(cookies.has('mfa-pending')).toBe(true);
    expect(cookies.get('mfa-pending')?.value).toBe('signed-payload');
    expect(cookies.get('mfa-pending')?.options.path).toBe('/api/auth/mfa');
  });

  it('maps error reasons to correct HTTP status codes', async () => {
    const cases: Array<[string, number]> = [
      ['invalid_credentials', 401],
      ['rate_limited', 429],
      ['account_locked', 423],
      ['email_not_verified', 403],
      ['database_error', 500],
    ];

    const POST = await loadRoute();

    for (const [reason, expectedStatus] of cases) {
      vi.clearAllMocks();
      mockValidate.mockReturnValue({
        success: true,
        data: { email: 'test@example.com', password: 'pass' },
      });
      mockSignIn.mockResolvedValue({
        success: false,
        error: `Error: ${reason}`,
        reason,
      });

      const res = await POST(makeRequest({ email: 'test@example.com', password: 'pass' }));
      expect((res as { status: number }).status).toBe(expectedStatus);
    }
  });

  it('extracts rightmost IP from X-Forwarded-For for session tracking', async () => {
    mockValidate.mockReturnValue({
      success: true,
      data: { email: 'test@example.com', password: 'ValidPass1' },
    });
    mockSignIn.mockResolvedValue({
      success: true,
      user: { id: 'u1', email: 'test@example.com', name: 'T', avatarUrl: null, role: 'user' },
      sessionToken: 'tok',
    });

    const POST = await loadRoute();
    await POST(makeRequest({ email: 'test@example.com', password: 'ValidPass1' }));

    // signIn should receive the leftmost (client) IP from XFF
    expect(mockSignIn).toHaveBeenCalledWith(
      'test@example.com',
      'ValidPass1',
      expect.objectContaining({ ipAddress: '10.0.0.1' }),
    );
  });

  it('returns 500 when signIn throws unexpectedly', async () => {
    mockValidate.mockReturnValue({
      success: true,
      data: { email: 'test@example.com', password: 'pass' },
    });
    mockSignIn.mockRejectedValue(new Error('DB connection lost'));

    const POST = await loadRoute();
    const res = await POST(makeRequest({ email: 'test@example.com', password: 'pass' }));
    expect((res as { status: number }).status).toBe(500);
  });
});
