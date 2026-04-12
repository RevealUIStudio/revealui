// @vitest-environment node
/**
 * OAuth Account Linking API Route Tests
 *
 * Unit tests for the admin OAuth link/unlink/me API routes.
 * Mocks session, auth functions, and logger to test route logic in isolation.
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup  -  must be before any route imports
// ---------------------------------------------------------------------------

const mockGetSession = vi.fn();
const mockGenerateOAuthState = vi.fn();
const mockBuildAuthUrl = vi.fn();
const mockVerifyOAuthState = vi.fn();
const mockExchangeCode = vi.fn();
const mockFetchProviderUser = vi.fn();
const mockLinkOAuthAccount = vi.fn();
const mockUnlinkOAuthAccount = vi.fn();
const mockGetLinkedProviders = vi.fn();
const mockIsRecoverySession = vi.fn().mockReturnValue(false);

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  generateOAuthState: (...args: unknown[]) => mockGenerateOAuthState(...args),
  buildAuthUrl: (...args: unknown[]) => mockBuildAuthUrl(...args),
  verifyOAuthState: (...args: unknown[]) => mockVerifyOAuthState(...args),
  exchangeCode: (...args: unknown[]) => mockExchangeCode(...args),
  fetchProviderUser: (...args: unknown[]) => mockFetchProviderUser(...args),
  linkOAuthAccount: (...args: unknown[]) => mockLinkOAuthAccount(...args),
  unlinkOAuthAccount: (...args: unknown[]) => mockUnlinkOAuthAccount(...args),
  getLinkedProviders: (...args: unknown[]) => mockGetLinkedProviders(...args),
  isRecoverySession: (...args: unknown[]) => mockIsRecoverySession(...args),
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/utils/error-response', () => ({
  createApplicationErrorResponse: vi.fn(
    (message: string, _code: string, status: number) =>
      new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  ),
  createErrorResponse: vi.fn(
    (_error: unknown, _context: unknown) =>
      new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
  ),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:4000';

const sessionUser = {
  id: 'user-123',
  email: 'alice@example.com',
  name: 'Alice',
  avatarUrl: null,
  role: 'admin',
  status: 'active',
  emailVerified: true,
  password: 'hashed-password',
};

const mockSession = {
  user: sessionUser,
  session: {
    id: 'sess-1',
    userId: sessionUser.id,
    expiresAt: new Date(Date.now() + 3600_000),
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  url: string,
  options?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
  return new NextRequest(new URL(url, BASE_URL), options);
}

// ==========================================================================
// Link Initiate Route: GET /api/auth/link/[provider]
// ==========================================================================

describe('GET /api/auth/link/[provider]', () => {
  let handler: (
    req: NextRequest,
    ctx: { params: Promise<{ provider: string }> },
  ) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../app/api/auth/link/[provider]/route');
    handler = mod.GET;
  });

  it('should return 404 for unknown provider', async () => {
    const req = createRequest('/api/auth/link/facebook');
    const res = await handler(req, { params: Promise.resolve({ provider: 'facebook' }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Unknown provider');
  });

  it('should redirect to login if not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const req = createRequest('/api/auth/link/github');
    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    // Redirect response
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('session_required');
  });

  it('should redirect to OAuth provider when authenticated', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockGenerateOAuthState.mockReturnValue({
      state: 'test-state',
      cookieValue: 'test-state.hmac',
    });
    mockBuildAuthUrl.mockReturnValue('https://github.com/login/oauth/authorize?state=test-state');

    const req = createRequest('/api/auth/link/github');
    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('github.com');
    // Should set link_oauth_state cookie
    const cookies = res.headers.getSetCookie();
    const stateCookie = cookies.find((c) => c.includes('link_oauth_state'));
    expect(stateCookie).toBeDefined();
  });

  it('should redirect to settings with error if buildAuthUrl throws', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockGenerateOAuthState.mockReturnValue({
      state: 'test-state',
      cookieValue: 'test-state.hmac',
    });
    mockBuildAuthUrl.mockImplementation(() => {
      throw new Error('Missing client ID for provider: github');
    });

    const req = createRequest('/api/auth/link/github');
    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/admin/settings');
    expect(location).toContain('error=');
  });

  it('should accept google and vercel as valid providers', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockGenerateOAuthState.mockReturnValue({
      state: 's',
      cookieValue: 's.h',
    });
    mockBuildAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth');

    for (const provider of ['google', 'vercel']) {
      vi.clearAllMocks();
      mockGetSession.mockResolvedValue(mockSession);
      mockGenerateOAuthState.mockReturnValue({ state: 's', cookieValue: 's.h' });
      mockBuildAuthUrl.mockReturnValue(`https://provider.example.com/auth?p=${provider}`);

      const req = createRequest(`/api/auth/link/${provider}`);
      const res = await handler(req, { params: Promise.resolve({ provider }) });

      // Should redirect (not 404)
      expect(res.status).toBe(307);
    }
  });
});

// ==========================================================================
// Link Callback Route: GET /api/auth/link/callback/[provider]
// ==========================================================================

describe('GET /api/auth/link/callback/[provider]', () => {
  let handler: (
    req: NextRequest,
    ctx: { params: Promise<{ provider: string }> },
  ) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../app/api/auth/link/callback/[provider]/route');
    handler = mod.GET;
  });

  it('should redirect with error for unknown provider', async () => {
    const req = createRequest('/api/auth/link/callback/facebook?code=abc&state=xyz');
    const res = await handler(req, { params: Promise.resolve({ provider: 'facebook' }) });

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/admin/settings');
    expect(location).toContain('unknown_provider');
  });

  it('should redirect to login if session expired', async () => {
    mockGetSession.mockResolvedValue(null);

    const req = createRequest('/api/auth/link/callback/github?code=abc&state=xyz');
    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('session_expired');
  });

  it('should redirect with error on invalid CSRF state', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockVerifyOAuthState.mockReturnValue(null);

    const req = createRequest('/api/auth/link/callback/github?code=abc&state=bad-state');
    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('invalid_state');
  });

  it('should link provider and redirect to settings on success', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockVerifyOAuthState.mockReturnValue({ provider: 'github', redirectTo: '/admin/settings' });
    mockExchangeCode.mockResolvedValue('access-token-123');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-user-1',
      email: 'alice@github.com',
      name: 'Alice',
      avatarUrl: null,
    });
    mockLinkOAuthAccount.mockResolvedValue(sessionUser);

    const req = createRequest('/api/auth/link/callback/github?code=valid-code&state=valid-state');
    // Add the cookie
    Object.defineProperty(req, 'cookies', {
      value: {
        get: vi.fn((name: string) => {
          if (name === 'link_oauth_state') return { value: 'valid-state.hmac' };
          return undefined;
        }),
      },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/admin/settings');
    expect(location).toContain('linked=github');
    expect(mockLinkOAuthAccount).toHaveBeenCalledWith('user-123', 'github', {
      id: 'gh-user-1',
      email: 'alice@github.com',
      name: 'Alice',
      avatarUrl: null,
    });
  });

  it('should redirect with error when linkOAuthAccount throws', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockVerifyOAuthState.mockReturnValue({ provider: 'github', redirectTo: '/admin/settings' });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-user-1',
      email: 'alice@github.com',
      name: 'Alice',
      avatarUrl: null,
    });
    mockLinkOAuthAccount.mockRejectedValue(
      new Error('This provider account is already linked to another user.'),
    );

    const req = createRequest('/api/auth/link/callback/github?code=c&state=s');
    Object.defineProperty(req, 'cookies', {
      value: {
        get: vi.fn((name: string) => {
          if (name === 'link_oauth_state') return { value: 's.hmac' };
          return undefined;
        }),
      },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/admin/settings');
    expect(location).toContain('error=');
    // Cookie should be cleaned up
    const cookies = res.headers.getSetCookie();
    const deletedCookie = cookies.find((c) => c.includes('link_oauth_state'));
    expect(deletedCookie).toBeDefined();
  });

  it('should redirect with error when code exchange fails', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockVerifyOAuthState.mockReturnValue({ provider: 'github', redirectTo: '/admin/settings' });
    mockExchangeCode.mockRejectedValue(new Error('Invalid code'));

    const req = createRequest('/api/auth/link/callback/github?code=bad&state=s');
    Object.defineProperty(req, 'cookies', {
      value: {
        get: vi.fn((name: string) => {
          if (name === 'link_oauth_state') return { value: 's.hmac' };
          return undefined;
        }),
      },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('error=');
  });
});

// ==========================================================================
// Unlink Route: POST /api/auth/unlink
// ==========================================================================

describe('POST /api/auth/unlink', () => {
  let handler: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../app/api/auth/unlink/route');
    handler = mod.POST;
  });

  it('should return 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const req = createRequest('/api/auth/unlink', {
      method: 'POST',
      body: JSON.stringify({ provider: 'github' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('should return 400 for invalid JSON body', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const req = createRequest('/api/auth/unlink', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    });

    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON');
  });

  it('should return 400 for missing provider', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const req = createRequest('/api/auth/unlink', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid provider');
  });

  it('should return 400 for unknown provider', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const req = createRequest('/api/auth/unlink', {
      method: 'POST',
      body: JSON.stringify({ provider: 'facebook' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid provider');
  });

  it('should successfully unlink a provider', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockUnlinkOAuthAccount.mockResolvedValue(undefined);

    const req = createRequest('/api/auth/unlink', {
      method: 'POST',
      body: JSON.stringify({ provider: 'github' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.unlinked).toBe('github');
    expect(mockUnlinkOAuthAccount).toHaveBeenCalledWith('user-123', 'github');
  });

  it('should return 400 when unlinkOAuthAccount throws (last auth method)', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockUnlinkOAuthAccount.mockRejectedValue(
      new Error('Cannot unlink your only sign-in method. Set a password first.'),
    );

    const req = createRequest('/api/auth/unlink', {
      method: 'POST',
      body: JSON.stringify({ provider: 'github' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Cannot unlink');
  });

  it('should return 400 when provider is not linked', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockUnlinkOAuthAccount.mockRejectedValue(
      new Error('No github account is linked to your account'),
    );

    const req = createRequest('/api/auth/unlink', {
      method: 'POST',
      body: JSON.stringify({ provider: 'github' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('No github account is linked');
  });

  it('should accept google and vercel as valid providers', async () => {
    for (const provider of ['google', 'vercel']) {
      vi.clearAllMocks();
      mockGetSession.mockResolvedValue(mockSession);
      mockUnlinkOAuthAccount.mockResolvedValue(undefined);

      const req = createRequest('/api/auth/unlink', {
        method: 'POST',
        body: JSON.stringify({ provider }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.unlinked).toBe(provider);
    }
  });
});

// ==========================================================================
// Me Route: GET /api/auth/me
// ==========================================================================

describe('GET /api/auth/me', () => {
  let handler: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../app/api/auth/me/route');
    handler = mod.GET;
  });

  it('should return 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const req = createRequest('/api/auth/me');
    const res = await handler(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should return user info with linked providers', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockGetLinkedProviders.mockResolvedValue([
      { provider: 'github', providerEmail: 'alice@github.com', providerName: 'Alice GH' },
      { provider: 'google', providerEmail: 'alice@gmail.com', providerName: 'Alice G' },
    ]);

    const req = createRequest('/api/auth/me');
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.user.id).toBe('user-123');
    expect(body.user.email).toBe('alice@example.com');
    expect(body.user.name).toBe('Alice');
    expect(body.user.role).toBe('admin');
    expect(body.user.hasPassword).toBe(true);

    expect(body.user.linkedProviders).toHaveLength(2);
    expect(body.user.linkedProviders[0]).toEqual({
      provider: 'github',
      email: 'alice@github.com',
      name: 'Alice GH',
    });
  });

  it('should return hasPassword: false for OAuth-only user', async () => {
    const oauthOnlySession = {
      ...mockSession,
      user: { ...sessionUser, password: null },
    };
    mockGetSession.mockResolvedValue(oauthOnlySession);
    mockGetLinkedProviders.mockResolvedValue([
      { provider: 'github', providerEmail: 'alice@github.com', providerName: 'Alice' },
    ]);

    const req = createRequest('/api/auth/me');
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.hasPassword).toBe(false);
  });

  it('should return empty linkedProviders when none are linked', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockGetLinkedProviders.mockResolvedValue([]);

    const req = createRequest('/api/auth/me');
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.linkedProviders).toEqual([]);
  });

  it('should still return user info if getLinkedProviders fails', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockGetLinkedProviders.mockRejectedValue(new Error('DB connection error'));

    const req = createRequest('/api/auth/me');
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe('user-123');
    // linkedProviders should fall back to empty array
    expect(body.user.linkedProviders).toEqual([]);
  });

  it('should include emailVerified field', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockGetLinkedProviders.mockResolvedValue([]);

    const req = createRequest('/api/auth/me');
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.emailVerified).toBe(true);
  });

  it('should not expose password hash in response', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockGetLinkedProviders.mockResolvedValue([]);

    const req = createRequest('/api/auth/me');
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.password).toBeUndefined();
    expect(body.user.passwordHash).toBeUndefined();
  });

  it('should map providerEmail and providerName to email and name', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockGetLinkedProviders.mockResolvedValue([
      { provider: 'vercel', providerEmail: null, providerName: null },
    ]);

    const req = createRequest('/api/auth/me');
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.linkedProviders[0]).toEqual({
      provider: 'vercel',
      email: null,
      name: null,
    });
  });
});
