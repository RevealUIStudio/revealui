// @vitest-environment node
/**
 * OAuth Provider Route Tests
 *
 * Tests for:
 * - GET /api/auth/[provider]  -  OAuth initiate (redirect to provider)
 * - GET /api/auth/callback/[provider]  -  OAuth callback (code exchange, session creation)
 *
 * Mocks @revealui/auth/server and @revealui/core logger to test route logic in isolation.
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup  -  must be before any route imports
// ---------------------------------------------------------------------------

const mockGenerateOAuthState = vi.fn();
const mockBuildAuthUrl = vi.fn();
const mockVerifyOAuthState = vi.fn();
const mockExchangeCode = vi.fn();
const mockFetchProviderUser = vi.fn();
const mockUpsertOAuthUser = vi.fn();
const mockCreateSession = vi.fn();

class MockOAuthAccountConflictError extends Error {
  constructor(message = 'Account already exists') {
    super(message);
    this.name = 'OAuthAccountConflictError';
  }
}

vi.mock('@revealui/auth/server', () => ({
  generateOAuthState: (...args: unknown[]) => mockGenerateOAuthState(...args),
  buildAuthUrl: (...args: unknown[]) => mockBuildAuthUrl(...args),
  verifyOAuthState: (...args: unknown[]) => mockVerifyOAuthState(...args),
  exchangeCode: (...args: unknown[]) => mockExchangeCode(...args),
  fetchProviderUser: (...args: unknown[]) => mockFetchProviderUser(...args),
  upsertOAuthUser: (...args: unknown[]) => mockUpsertOAuthUser(...args),
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  rotateSession: (...args: unknown[]) => mockCreateSession(...args),
  OAuthAccountConflictError: MockOAuthAccountConflictError,
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock license + DB modules used by callback route (user limit enforcement)
vi.mock('@revealui/core/license', () => ({
  initializeLicense: vi.fn().mockResolvedValue(undefined),
  getMaxUsers: vi.fn().mockReturnValue(Infinity),
}));

vi.mock('@revealui/db', () => ({
  getClient: vi.fn().mockReturnValue({}),
}));

vi.mock('@revealui/db/queries/oauth-accounts', () => ({
  getOAuthAccountByProviderUser: vi.fn().mockResolvedValue(null),
}));

vi.mock('@revealui/db/queries/users', () => ({
  countActiveUsers: vi.fn().mockResolvedValue(0),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  url: string,
  options?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
  return new NextRequest(new URL(url, BASE_URL), options);
}

function getRedirectLocation(res: Response): string {
  return res.headers.get('location') ?? '';
}

function getSetCookies(res: Response): string[] {
  return res.headers.getSetCookie();
}

// ==========================================================================
// Initiate Route: GET /api/auth/[provider]
// ==========================================================================

describe('GET /api/auth/[provider]', () => {
  let handler: (
    req: NextRequest,
    ctx: { params: Promise<{ provider: string }> },
  ) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../app/api/auth/[provider]/route');
    handler = mod.GET;
  });

  // ---- Provider validation ----

  it('should return 404 JSON for unknown provider', async () => {
    const req = createRequest('/api/auth/facebook');
    const res = await handler(req, { params: Promise.resolve({ provider: 'facebook' }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Unknown provider');
  });

  it('should return 404 for empty provider string', async () => {
    const req = createRequest('/api/auth/');
    const res = await handler(req, { params: Promise.resolve({ provider: '' }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Unknown provider');
  });

  it('should return 404 for case-sensitive provider mismatch', async () => {
    const req = createRequest('/api/auth/GitHub');
    const res = await handler(req, { params: Promise.resolve({ provider: 'GitHub' }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Unknown provider');
  });

  // ---- Allowed providers ----

  for (const provider of ['google', 'github', 'vercel']) {
    it(`should accept "${provider}" as a valid provider`, async () => {
      mockGenerateOAuthState.mockReturnValue({
        state: 'test-state',
        cookieValue: 'test-state.hmac',
        codeChallenge: 'test-challenge',
      });
      mockBuildAuthUrl.mockReturnValue(`https://${provider}.example.com/auth`);

      const req = createRequest(`/api/auth/${provider}`);
      const res = await handler(req, { params: Promise.resolve({ provider }) });

      expect(res.status).toBe(307);
      expect(getRedirectLocation(res)).toContain(`${provider}.example.com`);
    });
  }

  // ---- State and redirect ----

  it('should generate OAuth state with provider and default redirectTo', async () => {
    mockGenerateOAuthState.mockReturnValue({
      state: 'state-abc',
      cookieValue: 'state-abc.hmac',
      codeChallenge: 'challenge-abc',
    });
    mockBuildAuthUrl.mockReturnValue('https://github.com/login/oauth/authorize');

    const req = createRequest('/api/auth/github');
    await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(mockGenerateOAuthState).toHaveBeenCalledWith('github', '/admin', {
      linkConsent: undefined,
    });
  });

  it('should pass custom redirectTo from query param', async () => {
    mockGenerateOAuthState.mockReturnValue({
      state: 'state-abc',
      cookieValue: 'state-abc.hmac',
      codeChallenge: 'challenge-abc',
    });
    mockBuildAuthUrl.mockReturnValue('https://github.com/login/oauth/authorize');

    const req = createRequest('/api/auth/github?redirectTo=/dashboard/settings');
    await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(mockGenerateOAuthState).toHaveBeenCalledWith('github', '/dashboard/settings', {
      linkConsent: undefined,
    });
  });

  it('should construct correct redirectUri for buildAuthUrl', async () => {
    mockGenerateOAuthState.mockReturnValue({
      state: 'state-abc',
      cookieValue: 'state-abc.hmac',
      codeChallenge: 'challenge-abc',
    });
    mockBuildAuthUrl.mockReturnValue('https://github.com/auth');

    const req = createRequest('/api/auth/github');
    await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(mockBuildAuthUrl).toHaveBeenCalledWith(
      'github',
      `${BASE_URL}/api/auth/callback/github`,
      'state-abc',
      'challenge-abc',
    );
  });

  // ---- Cookie handling ----

  it('should set oauth_state cookie with correct attributes', async () => {
    mockGenerateOAuthState.mockReturnValue({
      state: 'state-xyz',
      cookieValue: 'state-xyz.hmac-sig',
      codeChallenge: 'challenge-xyz',
    });
    mockBuildAuthUrl.mockReturnValue('https://github.com/auth');

    const req = createRequest('/api/auth/github');
    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    const cookies = getSetCookies(res);
    const stateCookie = cookies.find((c) => c.includes('oauth_state'));
    expect(stateCookie).toBeDefined();
    expect(stateCookie).toContain('state-xyz.hmac-sig');
    expect(stateCookie).toContain('HttpOnly');
    expect(stateCookie).toContain('Path=/');
    expect(stateCookie).toContain('Max-Age=300');
    expect(stateCookie?.toLowerCase()).toContain('samesite=lax');
  });

  it('should set secure flag on cookie in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    mockGenerateOAuthState.mockReturnValue({
      state: 's',
      cookieValue: 's.h',
      codeChallenge: 'c',
    });
    mockBuildAuthUrl.mockReturnValue('https://github.com/auth');

    const req = createRequest('/api/auth/github');
    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    const cookies = getSetCookies(res);
    const stateCookie = cookies.find((c) => c.includes('oauth_state'));
    expect(stateCookie).toContain('Secure');

    vi.unstubAllEnvs();
  });

  // ---- Error handling ----

  it('should redirect to /login with error when buildAuthUrl throws', async () => {
    mockGenerateOAuthState.mockReturnValue({
      state: 's',
      cookieValue: 's.h',
      codeChallenge: 'c',
    });
    mockBuildAuthUrl.mockImplementation(() => {
      throw new Error('Missing client ID for github');
    });

    const req = createRequest('/api/auth/github');
    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    const location = getRedirectLocation(res);
    expect(location).toContain('/login');
    expect(location).toContain('error=');
    expect(location).toContain('Missing%20client%20ID');
  });

  it('should use fallback message when buildAuthUrl throws non-Error', async () => {
    mockGenerateOAuthState.mockReturnValue({
      state: 's',
      cookieValue: 's.h',
      codeChallenge: 'c',
    });
    mockBuildAuthUrl.mockImplementation(() => {
      throw 'string error';
    });

    const req = createRequest('/api/auth/github');
    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    const location = getRedirectLocation(res);
    expect(location).toContain('OAuth%20not%20configured');
  });

  // ---- Base URL resolution ----

  it('should prefer NEXT_PUBLIC_APP_URL for base URL', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://admin.revealui.com';
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://server.revealui.com';

    mockGenerateOAuthState.mockReturnValue({ state: 's', cookieValue: 's.h', codeChallenge: 'c' });
    mockBuildAuthUrl.mockReturnValue('https://github.com/auth');

    const req = createRequest('/api/auth/github');
    await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(mockBuildAuthUrl).toHaveBeenCalledWith(
      'github',
      'https://admin.revealui.com/api/auth/callback/github',
      's',
      'c',
    );

    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SERVER_URL;
  });
});

// ==========================================================================
// Callback Route: GET /api/auth/callback/[provider]
// ==========================================================================

describe('GET /api/auth/callback/[provider]', () => {
  let handler: (
    req: NextRequest,
    ctx: { params: Promise<{ provider: string }> },
  ) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../app/api/auth/callback/[provider]/route');
    handler = mod.GET;
  });

  // ---- Provider validation ----

  it('should redirect to login with unknown_provider for invalid provider', async () => {
    const req = createRequest('/api/auth/callback/facebook?code=abc&state=xyz');
    const res = await handler(req, { params: Promise.resolve({ provider: 'facebook' }) });

    expect(res.status).toBe(307);
    const location = getRedirectLocation(res);
    expect(location).toContain('/login');
    expect(location).toContain('unknown_provider');
  });

  it('should redirect for empty provider', async () => {
    const req = createRequest('/api/auth/callback/?code=abc&state=xyz');
    const res = await handler(req, { params: Promise.resolve({ provider: '' }) });

    expect(res.status).toBe(307);
    expect(getRedirectLocation(res)).toContain('unknown_provider');
  });

  // ---- State verification ----

  it('should redirect with invalid_state when state verification fails', async () => {
    mockVerifyOAuthState.mockReturnValue(null);

    const req = createRequest('/api/auth/callback/github?code=abc&state=bad-state');
    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    expect(getRedirectLocation(res)).toContain('invalid_state');
  });

  it('should pass state and cookie to verifyOAuthState', async () => {
    mockVerifyOAuthState.mockReturnValue(null);

    const req = createRequest('/api/auth/callback/github?code=abc&state=the-state');
    // Override cookies to include the oauth_state cookie
    Object.defineProperty(req, 'cookies', {
      value: {
        get: vi.fn((name: string) => {
          if (name === 'oauth_state') return { value: 'the-state.hmac' };
          return undefined;
        }),
      },
    });

    await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(mockVerifyOAuthState).toHaveBeenCalledWith('the-state', 'the-state.hmac');
  });

  it('should redirect with invalid_state when no state query param', async () => {
    mockVerifyOAuthState.mockReturnValue(null);

    const req = createRequest('/api/auth/callback/github?code=abc');
    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    expect(getRedirectLocation(res)).toContain('invalid_state');
    expect(mockVerifyOAuthState).toHaveBeenCalledWith(null, undefined);
  });

  // ---- Successful flow ----

  it('should exchange code, upsert user, create session, and redirect', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('access-token-123');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-user-1',
      email: 'alice@github.com',
      name: 'Alice',
      avatarUrl: 'https://avatars.github.com/alice',
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'user-456', email: 'alice@github.com' });
    mockCreateSession.mockResolvedValue({ token: 'session-token-abc' });

    const req = createRequest('/api/auth/callback/github?code=valid-code&state=valid-state');
    Object.defineProperty(req, 'cookies', {
      value: {
        get: vi.fn((name: string) => {
          if (name === 'oauth_state') return { value: 'valid-state.hmac' };
          return undefined;
        }),
      },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    expect(getRedirectLocation(res)).toContain('/admin');

    expect(mockExchangeCode).toHaveBeenCalledWith(
      'github',
      'valid-code',
      `${BASE_URL}/api/auth/callback/github`,
      'test-verifier',
    );
    expect(mockFetchProviderUser).toHaveBeenCalledWith('github', 'access-token-123');
    expect(mockUpsertOAuthUser).toHaveBeenCalledWith(
      'github',
      {
        id: 'gh-user-1',
        email: 'alice@github.com',
        name: 'Alice',
        avatarUrl: 'https://avatars.github.com/alice',
      },
      { linkConsent: undefined },
    );
    expect(mockCreateSession).toHaveBeenCalledWith('user-456', {
      userAgent: undefined,
      ipAddress: undefined,
      persistent: true,
    });
  });

  it('should set revealui-session cookie on success', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
    mockCreateSession.mockResolvedValue({ token: 'sess-tok-123' });

    const req = createRequest('/api/auth/callback/github?code=c&state=s');
    Object.defineProperty(req, 'cookies', {
      value: {
        get: vi.fn(() => ({ value: 's.h' })),
      },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    const cookies = getSetCookies(res);
    const sessionCookie = cookies.find((c) => c.includes('revealui-session'));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('sess-tok-123');
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('Path=/');
    expect(sessionCookie?.toLowerCase()).toContain('samesite=lax');
    // 7 days = 604800 seconds
    expect(sessionCookie).toContain('Max-Age=604800');
  });

  it('should delete oauth_state cookie on success', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
    mockCreateSession.mockResolvedValue({ token: 'tok' });

    const req = createRequest('/api/auth/callback/github?code=c&state=s');
    Object.defineProperty(req, 'cookies', {
      value: {
        get: vi.fn(() => ({ value: 's.h' })),
      },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    const cookies = getSetCookies(res);
    const deletedCookie = cookies.find(
      (c) => c.includes('oauth_state') && !c.includes('revealui-session'),
    );
    expect(deletedCookie).toBeDefined();
  });

  // ---- User-agent and IP extraction ----

  it('should pass user-agent to createSession', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
    mockCreateSession.mockResolvedValue({ token: 'tok' });

    const req = createRequest('/api/auth/callback/github?code=c&state=s', {
      headers: { 'user-agent': 'Mozilla/5.0 TestBrowser' },
    });
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(mockCreateSession).toHaveBeenCalledWith('u-1', {
      userAgent: 'Mozilla/5.0 TestBrowser',
      ipAddress: undefined,
      persistent: true,
    });
  });

  it('should extract IP from x-forwarded-for header (last entry)', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
    mockCreateSession.mockResolvedValue({ token: 'tok' });

    const req = createRequest('/api/auth/callback/github?code=c&state=s', {
      headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.1, 203.0.113.50' },
    });
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(mockCreateSession).toHaveBeenCalledWith('u-1', {
      userAgent: undefined,
      ipAddress: '10.0.0.1',
      persistent: true,
    });
  });

  it('should fall back to x-real-ip when x-forwarded-for is absent', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
    mockCreateSession.mockResolvedValue({ token: 'tok' });

    const req = createRequest('/api/auth/callback/github?code=c&state=s', {
      headers: { 'x-real-ip': '198.51.100.42' },
    });
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(mockCreateSession).toHaveBeenCalledWith('u-1', {
      userAgent: undefined,
      ipAddress: '198.51.100.42',
      persistent: true,
    });
  });

  // ---- Email allowlist ----

  it('should allow any email when OAUTH_ADMIN_EMAILS is not set', async () => {
    delete process.env.OAUTH_ADMIN_EMAILS;

    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'anyone@example.com',
      name: 'Anyone',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
    mockCreateSession.mockResolvedValue({ token: 'tok' });

    const req = createRequest('/api/auth/callback/github?code=c&state=s');
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });
    expect(res.status).toBe(307);
    expect(getRedirectLocation(res)).toContain('/admin');
  });

  it('should block email not in OAUTH_ADMIN_EMAILS allowlist', async () => {
    process.env.OAUTH_ADMIN_EMAILS = 'admin@revealui.com, boss@revealui.com';

    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'outsider@evil.com',
      name: 'Outsider',
      avatarUrl: null,
    });

    const req = createRequest('/api/auth/callback/github?code=c&state=s');
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    expect(getRedirectLocation(res)).toContain('not_allowed');

    delete process.env.OAUTH_ADMIN_EMAILS;
  });

  it('should allow email that IS in OAUTH_ADMIN_EMAILS allowlist', async () => {
    process.env.OAUTH_ADMIN_EMAILS = 'admin@revealui.com, boss@revealui.com';

    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'admin@revealui.com',
      name: 'Admin',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
    mockCreateSession.mockResolvedValue({ token: 'tok' });

    const req = createRequest('/api/auth/callback/github?code=c&state=s');
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });
    expect(res.status).toBe(307);
    expect(getRedirectLocation(res)).toContain('/admin');

    delete process.env.OAUTH_ADMIN_EMAILS;
  });

  // ---- Redirect safety (open redirect prevention) ----

  it('should redirect to /admin by default', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
    mockCreateSession.mockResolvedValue({ token: 'tok' });

    const req = createRequest('/api/auth/callback/github?code=c&state=s');
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    const location = getRedirectLocation(res);
    const url = new URL(location);
    expect(url.pathname).toBe('/admin');
  });

  it('should honor same-origin redirectTo from verified state', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/dashboard/settings?tab=profile',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
    mockCreateSession.mockResolvedValue({ token: 'tok' });

    const req = createRequest('/api/auth/callback/github?code=c&state=s');
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    const location = getRedirectLocation(res);
    const url = new URL(location);
    expect(url.pathname).toBe('/dashboard/settings');
    expect(url.searchParams.get('tab')).toBe('profile');
  });

  it('should reject cross-origin redirectTo and fall back to /admin', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: 'https://evil.com/steal',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
    mockCreateSession.mockResolvedValue({ token: 'tok' });

    const req = createRequest('/api/auth/callback/github?code=c&state=s');
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    const location = getRedirectLocation(res);
    const url = new URL(location);
    expect(url.pathname).toBe('/admin');
    expect(url.hostname).toBe('localhost');
  });

  // ---- Error handling ----

  it('should redirect with account_exists on OAuthAccountConflictError', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockRejectedValue(
      new MockOAuthAccountConflictError('Email already in use'),
    );

    const req = createRequest('/api/auth/callback/github?code=c&state=s');
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    expect(getRedirectLocation(res)).toContain('account_exists');
  });

  it('should redirect with oauth_error on generic error during code exchange', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockRejectedValue(new Error('Token exchange failed'));

    const req = createRequest('/api/auth/callback/github?code=bad&state=s');
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    expect(getRedirectLocation(res)).toContain('oauth_error');
  });

  it('should redirect with oauth_error on generic error during user fetch', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockRejectedValue(new Error('Provider API down'));

    const req = createRequest('/api/auth/callback/github?code=c&state=s');
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    expect(getRedirectLocation(res)).toContain('oauth_error');
  });

  it('should redirect with oauth_error when session creation fails', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
    mockCreateSession.mockRejectedValue(new Error('DB write failed'));

    const req = createRequest('/api/auth/callback/github?code=c&state=s');
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    expect(getRedirectLocation(res)).toContain('oauth_error');
  });

  // ---- All providers in callback ----

  for (const provider of ['google', 'github', 'vercel']) {
    it(`should process callback for "${provider}" provider`, async () => {
      mockVerifyOAuthState.mockReturnValue({
        provider,
        redirectTo: '/admin',
        codeVerifier: 'test-verifier',
      });
      mockExchangeCode.mockResolvedValue('token');
      mockFetchProviderUser.mockResolvedValue({
        id: `${provider}-user-1`,
        email: `user@${provider}.com`,
        name: 'User',
        avatarUrl: null,
      });
      mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
      mockCreateSession.mockResolvedValue({ token: 'tok' });

      const req = createRequest(`/api/auth/callback/${provider}?code=c&state=s`);
      Object.defineProperty(req, 'cookies', {
        value: { get: vi.fn(() => ({ value: 's.h' })) },
      });

      const res = await handler(req, { params: Promise.resolve({ provider }) });

      expect(res.status).toBe(307);
      expect(mockExchangeCode).toHaveBeenCalledWith(
        provider,
        'c',
        `${BASE_URL}/api/auth/callback/${provider}`,
        'test-verifier',
      );
    });
  }

  // ---- Production cookie domain ----

  it('should set cookie domain in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '.revealui.com');

    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
    mockCreateSession.mockResolvedValue({ token: 'tok' });

    const req = createRequest('/api/auth/callback/github?code=c&state=s');
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    const res = await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    const cookies = getSetCookies(res);
    const sessionCookie = cookies.find((c) => c.includes('revealui-session'));
    expect(sessionCookie).toContain('Secure');
    expect(sessionCookie).toContain('Domain=.revealui.com');

    vi.unstubAllEnvs();
  });

  // ---- Missing code parameter ----

  it('should pass empty string when code query param is missing', async () => {
    mockVerifyOAuthState.mockReturnValue({
      provider: 'github',
      redirectTo: '/admin',
      codeVerifier: 'test-verifier',
    });
    mockExchangeCode.mockResolvedValue('token');
    mockFetchProviderUser.mockResolvedValue({
      id: 'gh-1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
    });
    mockUpsertOAuthUser.mockResolvedValue({ id: 'u-1' });
    mockCreateSession.mockResolvedValue({ token: 'tok' });

    const req = createRequest('/api/auth/callback/github?state=s');
    Object.defineProperty(req, 'cookies', {
      value: { get: vi.fn(() => ({ value: 's.h' })) },
    });

    await handler(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(mockExchangeCode).toHaveBeenCalledWith(
      'github',
      '',
      `${BASE_URL}/api/auth/callback/github`,
      'test-verifier',
    );
  });
});
