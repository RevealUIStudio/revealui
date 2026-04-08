/**
 * Tests for OAuth routes:
 * - GET /api/auth/[provider] (initiate)
 * - GET /api/auth/callback/[provider] (callback)
 *
 * Security-critical: CSRF state verification, open redirect prevention.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuildAuthUrl = vi.fn();
const mockGenerateOAuthState = vi.fn();
const mockVerifyOAuthState = vi.fn();
const mockExchangeCode = vi.fn();
const mockFetchProviderUser = vi.fn();
const mockUpsertOAuthUser = vi.fn();
const mockCreateSession = vi.fn();
const mockGetClient = vi.fn();
const mockInitializeLicense = vi.fn();
const mockGetMaxUsers = vi.fn();

class MockOAuthAccountConflictError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'OAuthAccountConflictError';
  }
}

vi.mock('@revealui/auth/server', () => ({
  buildAuthUrl: (...args: unknown[]) => mockBuildAuthUrl(...args),
  generateOAuthState: (...args: unknown[]) => mockGenerateOAuthState(...args),
  verifyOAuthState: (...args: unknown[]) => mockVerifyOAuthState(...args),
  exchangeCode: (...args: unknown[]) => mockExchangeCode(...args),
  fetchProviderUser: (...args: unknown[]) => mockFetchProviderUser(...args),
  upsertOAuthUser: (...args: unknown[]) => mockUpsertOAuthUser(...args),
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  rotateSession: (...args: unknown[]) => mockCreateSession(...args),
  OAuthAccountConflictError: MockOAuthAccountConflictError,
}));

vi.mock('@revealui/core/license', () => ({
  initializeLicense: (...args: unknown[]) => mockInitializeLicense(...args),
  getMaxUsers: () => mockGetMaxUsers(),
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@revealui/db', () => ({
  getClient: () => mockGetClient(),
}));

vi.mock('@revealui/db/schema', () => ({
  oauthAccounts: {
    userId: 'userId',
    provider: 'provider',
    providerUserId: 'providerUserId',
    deletedAt: 'deletedAt',
  },
  users: { status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  isNull: vi.fn(),
  count: vi.fn(),
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
    delete(name: string) {
      this.store.delete(name);
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

// ─── GET /api/auth/[provider] ──────────────────────────────────────────────

describe('GET /api/auth/[provider] (OAuth initiate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:4000';
  });

  function makeRequest(searchParams?: Record<string, string>) {
    const url = new URL('http://localhost:4000/api/auth/github');
    if (searchParams) {
      for (const [k, v] of Object.entries(searchParams)) {
        url.searchParams.set(k, v);
      }
    }
    return { headers: { get: () => null }, nextUrl: url } as never;
  }

  async function loadRoute() {
    const mod = await import('../[provider]/route.js');
    return mod.GET;
  }

  it('returns 404 for unknown provider', async () => {
    const GET = await loadRoute();
    const res = await GET(makeRequest(), { params: Promise.resolve({ provider: 'myspace' }) });
    expect((res as MockRes).status).toBe(404);
  });

  it('redirects to auth URL and sets oauth_state cookie', async () => {
    mockGenerateOAuthState.mockReturnValue({
      state: 'random-state-string',
      cookieValue: 'signed-cookie-value',
    });
    mockBuildAuthUrl.mockReturnValue('https://github.com/login/oauth/authorize?client_id=xyz');

    const GET = await loadRoute();
    const res = await GET(makeRequest(), { params: Promise.resolve({ provider: 'github' }) });

    expect((res as MockRes).status).toBe(307);
    expect((res as MockRes).url).toContain('github.com/login/oauth/authorize');
    expect((res as MockRes).cookies.has('oauth_state')).toBe(true);
    expect((res as MockRes).cookies.get('oauth_state')?.value).toBe('signed-cookie-value');
  });

  it('redirects to /login with error when buildAuthUrl throws', async () => {
    mockGenerateOAuthState.mockReturnValue({ state: 's', cookieValue: 'c' });
    mockBuildAuthUrl.mockImplementation(() => {
      throw new Error('GITHUB_CLIENT_ID not set');
    });

    const GET = await loadRoute();
    const res = await GET(makeRequest(), { params: Promise.resolve({ provider: 'github' }) });

    expect((res as MockRes).status).toBe(307);
    expect((res as MockRes).url).toContain('/login?error=');
    expect((res as MockRes).url).toContain('GITHUB_CLIENT_ID');
  });
});

// ─── GET /api/auth/callback/[provider] ─────────────────────────────────────

describe('GET /api/auth/callback/[provider] (OAuth callback)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:4000';
  });

  function makeCallbackRequest(
    opts: { searchParams?: Record<string, string>; stateCookie?: string } = {},
  ) {
    const url = new URL('http://localhost:4000/api/auth/callback/github');
    if (opts.searchParams) {
      for (const [k, v] of Object.entries(opts.searchParams)) {
        url.searchParams.set(k, v);
      }
    }
    return {
      headers: {
        get: (key: string) => {
          if (key === 'user-agent') return 'test-agent';
          if (key === 'x-forwarded-for') return '10.0.0.1';
          return null;
        },
      },
      nextUrl: url,
      cookies: {
        get: (name: string) => {
          if (name === 'oauth_state' && opts.stateCookie) {
            return { value: opts.stateCookie };
          }
          return undefined;
        },
      },
    } as never;
  }

  async function loadRoute() {
    const mod = await import('../callback/[provider]/route.js');
    return mod.GET;
  }

  /** Set up mocks for a successful OAuth flow (override individual mocks after) */
  function setupHappyPath(opts: { redirectTo?: string; userRole?: string } = {}) {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: opts.redirectTo ?? '/admin',
    });
    mockExchangeCode.mockResolvedValue('access-token-123');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-user-1',
      email: 'user@example.com',
      name: 'Test User',
    });
    mockInitializeLicense.mockResolvedValue(undefined);
    mockGetMaxUsers.mockReturnValue(Infinity);
    mockUpsertOAuthUser.mockResolvedValue({
      id: 'local-user-1',
      email: 'user@example.com',
      role: opts.userRole ?? 'user',
    });
    mockCreateSession.mockResolvedValue({ token: 'session-token-abc' });
  }

  it('redirects with error for unknown provider', async () => {
    const GET = await loadRoute();
    const res = await GET(makeCallbackRequest(), {
      params: Promise.resolve({ provider: 'myspace' }),
    });
    expect((res as MockRes).url).toContain('error=unknown_provider');
  });

  it('redirects with error when state verification fails (CSRF)', async () => {
    mockVerifyOAuthState.mockReturnValue(null);

    const GET = await loadRoute();
    const res = await GET(
      makeCallbackRequest({
        searchParams: { code: 'auth-code', state: 'tampered-state' },
        stateCookie: 'original-cookie',
      }),
      { params: Promise.resolve({ provider: 'github' }) },
    );

    expect((res as MockRes).url).toContain('error=invalid_state');
    expect(mockVerifyOAuthState).toHaveBeenCalledWith('tampered-state', 'original-cookie');
  });

  it('redirects with error when OAuth account conflicts with existing user', async () => {
    setupHappyPath();
    mockUpsertOAuthUser.mockRejectedValue(
      new MockOAuthAccountConflictError('Account already linked'),
    );

    const GET = await loadRoute();
    const res = await GET(
      makeCallbackRequest({
        searchParams: { code: 'auth-code', state: 'valid-state' },
        stateCookie: 'valid-cookie',
      }),
      { params: Promise.resolve({ provider: 'github' }) },
    );

    expect((res as MockRes).url).toContain('error=account_exists');
  });

  it('prevents open redirect by comparing hostnames', async () => {
    setupHappyPath({ redirectTo: 'https://evil.com/steal-tokens' });

    const GET = await loadRoute();
    const res = await GET(
      makeCallbackRequest({
        searchParams: { code: 'auth-code', state: 'valid-state' },
        stateCookie: 'valid-cookie',
      }),
      { params: Promise.resolve({ provider: 'github' }) },
    );

    // Should redirect to /admin (safe default), not to evil.com
    expect((res as MockRes).url).toContain('localhost:4000/admin');
    expect((res as MockRes).url).not.toContain('evil.com');
  });

  it('creates session and sets cookies on successful flow', async () => {
    setupHappyPath();

    const GET = await loadRoute();
    const res = await GET(
      makeCallbackRequest({
        searchParams: { code: 'auth-code', state: 'valid-state' },
        stateCookie: 'valid-cookie',
      }),
      { params: Promise.resolve({ provider: 'github' }) },
    );

    expect((res as MockRes).status).toBe(307);
    expect((res as MockRes).url).toContain('/admin');
    expect((res as MockRes).cookies.has('revealui-session')).toBe(true);
    expect((res as MockRes).cookies.get('revealui-session')?.value).toBe('session-token-abc');
    expect((res as MockRes).cookies.get('revealui-role')?.value).toBe('user');
  });

  it('sets admin role cookie for admin users', async () => {
    setupHappyPath({ userRole: 'admin' });

    const GET = await loadRoute();
    const res = await GET(
      makeCallbackRequest({
        searchParams: { code: 'auth-code', state: 'valid-state' },
        stateCookie: 'valid-cookie',
      }),
      { params: Promise.resolve({ provider: 'github' }) },
    );

    expect((res as MockRes).cookies.get('revealui-role')?.value).toBe('admin');
  });
});
