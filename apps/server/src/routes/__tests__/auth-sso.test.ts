import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (vi.hoisted so factories can close over them)
// ---------------------------------------------------------------------------

const {
  mockAccountHasSsoFeature,
  mockSelectLimit,
  mockDb,
  mockGenerateSsoState,
  mockVerifySsoState,
  mockFetchOidcDiscovery,
  mockBuildOidcAuthorizationUrl,
  mockExchangeOidcCode,
  mockCreateOidcRemoteJwkSet,
  mockValidateOidcIdToken,
  mockMapSsoGroupsToRole,
  mockUpsertSsoUser,
  mockCreateSession,
} = vi.hoisted(() => {
  const mockSelectLimit = vi.fn();
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: (...args: unknown[]) => mockSelectLimit(...args),
        }),
      }),
    }),
  };
  return {
    mockAccountHasSsoFeature: vi.fn(),
    mockSelectLimit,
    mockDb,
    mockGenerateSsoState: vi.fn(),
    mockVerifySsoState: vi.fn(),
    mockFetchOidcDiscovery: vi.fn(),
    mockBuildOidcAuthorizationUrl: vi.fn(),
    mockExchangeOidcCode: vi.fn(),
    mockCreateOidcRemoteJwkSet: vi.fn(),
    mockValidateOidcIdToken: vi.fn(),
    mockMapSsoGroupsToRole: vi.fn(),
    mockUpsertSsoUser: vi.fn(),
    mockCreateSession: vi.fn(),
  };
});

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/account-entitlement.js', () => ({
  accountHasSsoFeature: (...args: unknown[]) => mockAccountHasSsoFeature(...args),
}));

vi.mock('../../lib/self-api-url.js', () => ({
  resolveSelfApiBaseUrl: () => 'https://api.example.com',
}));

vi.mock('@revealui/db/schema', () => ({
  accountSsoProviders: {
    id: 'accountSsoProviders.id',
    accountId: 'accountSsoProviders.accountId',
    providerType: 'accountSsoProviders.providerType',
    enabled: 'accountSsoProviders.enabled',
    issuer: 'accountSsoProviders.issuer',
    discoveryUrl: 'accountSsoProviders.discoveryUrl',
    clientId: 'accountSsoProviders.clientId',
    clientSecretRef: 'accountSsoProviders.clientSecretRef',
    samlMetadataUrl: 'accountSsoProviders.samlMetadataUrl',
    samlMetadataXml: 'accountSsoProviders.samlMetadataXml',
    samlSpEntityId: 'accountSsoProviders.samlSpEntityId',
    signingCertPem: 'accountSsoProviders.signingCertPem',
    groupClaim: 'accountSsoProviders.groupClaim',
    groupRoleMap: 'accountSsoProviders.groupRoleMap',
    defaultRole: 'accountSsoProviders.defaultRole',
    requireGroupMatch: 'accountSsoProviders.requireGroupMatch',
    deletedAt: 'accountSsoProviders.deletedAt',
  },
}));

vi.mock('@revealui/db', () => ({
  getClient: () => mockDb,
}));

vi.mock('@revealui/auth/server', () => ({
  generateSsoState: (...args: unknown[]) => mockGenerateSsoState(...args),
  verifySsoState: (...args: unknown[]) => mockVerifySsoState(...args),
  fetchOidcDiscovery: (...args: unknown[]) => mockFetchOidcDiscovery(...args),
  buildOidcAuthorizationUrl: (...args: unknown[]) => mockBuildOidcAuthorizationUrl(...args),
  exchangeOidcCode: (...args: unknown[]) => mockExchangeOidcCode(...args),
  createOidcRemoteJwkSet: (...args: unknown[]) => mockCreateOidcRemoteJwkSet(...args),
  validateOidcIdToken: (...args: unknown[]) => mockValidateOidcIdToken(...args),
  mapSsoGroupsToRole: (...args: unknown[]) => mockMapSsoGroupsToRole(...args),
  upsertSsoUser: (...args: unknown[]) => mockUpsertSsoUser(...args),
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  buildSamlAuthorizeUrl: vi.fn(),
  buildSamlSpMetadata: vi.fn(),
  fetchIdpMetadata: vi.fn(),
  parseIdpMetadataXml: vi.fn(),
  validateSamlPostResponse: vi.fn(),
}));

import { Hono } from 'hono';
import authSsoRoute, { resolveSsoClientSecret, safeSsoRedirectPath } from '../auth-sso.js';

const PROVIDER_ROW = {
  id: 'prov-1',
  accountId: 'acct-1',
  providerType: 'oidc',
  enabled: true,
  issuer: 'https://idp.example.com',
  discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration',
  clientId: 'client-1',
  clientSecretRef: 'REVEALUI_SSO_CLIENT_SECRET',
  groupClaim: 'groups',
  groupRoleMap: { Engineering: 'member' },
  defaultRole: 'member',
  requireGroupMatch: false,
};

function createApp() {
  const app = new Hono();
  app.route('/api/auth', authSsoRoute);
  return app;
}

describe('safeSsoRedirectPath', () => {
  it('allows relative paths starting with /', () => {
    expect(safeSsoRedirectPath('/admin')).toBe('/admin');
    expect(safeSsoRedirectPath('/settings?tab=sso')).toBe('/settings?tab=sso');
  });

  it('rejects open redirects', () => {
    expect(safeSsoRedirectPath('//evil.com')).toBe('/');
    expect(safeSsoRedirectPath('https://evil.com')).toBe('/');
    expect(safeSsoRedirectPath('/\\evil.com')).toBe('/');
    expect(safeSsoRedirectPath(null)).toBe('/');
    expect(safeSsoRedirectPath('')).toBe('/');
  });
});

describe('resolveSsoClientSecret', () => {
  beforeEach(() => {
    delete process.env.REVEALUI_SSO_CLIENT_SECRET;
    delete process.env['REVEALUI_SSO_CLIENT_SECRET_prov-1'];
    delete process.env.MY_SSO_SECRET;
  });

  it('reads clientSecretRef as env name', () => {
    process.env.MY_SSO_SECRET = 'from-ref';
    expect(resolveSsoClientSecret({ id: 'prov-1', clientSecretRef: 'MY_SSO_SECRET' })).toBe(
      'from-ref',
    );
  });

  it('falls back to REVEALUI_SSO_CLIENT_SECRET', () => {
    process.env.REVEALUI_SSO_CLIENT_SECRET = 'fallback';
    expect(resolveSsoClientSecret({ id: 'prov-1', clientSecretRef: null })).toBe('fallback');
  });
});

describe('GET /api/auth/sso/:providerId/init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_SSO_CLIENT_SECRET = 'test-secret';
    process.env.REVEALUI_SECRET = 'state-signing-secret-for-tests-only';
    mockAccountHasSsoFeature.mockResolvedValue(true);
    mockSelectLimit.mockResolvedValue([PROVIDER_ROW]);
    mockFetchOidcDiscovery.mockResolvedValue({
      ok: true,
      document: {
        issuer: PROVIDER_ROW.issuer,
        authorization_endpoint: 'https://idp.example.com/authorize',
        token_endpoint: 'https://idp.example.com/token',
        jwks_uri: 'https://idp.example.com/jwks',
      },
    });
    mockGenerateSsoState.mockReturnValue({
      state: 'state-token',
      cookieValue: 'state-token.hmac',
      codeChallenge: 'challenge',
    });
    mockBuildOidcAuthorizationUrl.mockReturnValue('https://idp.example.com/authorize?ok=1');
  });

  it('requires accountId query', async () => {
    const app = createApp();
    const res = await app.request('/api/auth/sso/prov-1/init');
    expect(res.status).toBe(400);
  });

  it('returns 404 when provider account mismatches (empty select)', async () => {
    mockSelectLimit.mockResolvedValue([]);
    const app = createApp();
    const res = await app.request('/api/auth/sso/prov-1/init?accountId=wrong-acct');
    expect(res.status).toBe(404);
  });

  it('returns 403 when entitlement is false', async () => {
    mockAccountHasSsoFeature.mockResolvedValue(false);
    const app = createApp();
    const res = await app.request('/api/auth/sso/prov-1/init?accountId=acct-1');
    expect(res.status).toBe(403);
  });

  it('redirects to IdP and sets sso_state cookie on success', async () => {
    const app = createApp();
    const res = await app.request(
      '/api/auth/sso/prov-1/init?accountId=acct-1&redirectTo=/dashboard',
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://idp.example.com/authorize?ok=1');
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('sso_state=state-token.hmac');
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(mockGenerateSsoState).toHaveBeenCalledWith({
      accountId: 'acct-1',
      providerId: 'prov-1',
      redirectTo: '/dashboard',
    });
  });

  it('sanitizes open-redirect redirectTo on init', async () => {
    const app = createApp();
    await app.request('/api/auth/sso/prov-1/init?accountId=acct-1&redirectTo=//evil.com');
    expect(mockGenerateSsoState).toHaveBeenCalledWith(expect.objectContaining({ redirectTo: '/' }));
  });
});

describe('GET /api/auth/sso/:providerId/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_SSO_CLIENT_SECRET = 'test-secret';
    process.env.REVEALUI_SECRET = 'state-signing-secret-for-tests-only';
    process.env.REVEALUI_PUBLIC_SERVER_URL = 'https://app.example.com';
    mockAccountHasSsoFeature.mockResolvedValue(true);
    mockSelectLimit.mockResolvedValue([PROVIDER_ROW]);
    mockVerifySsoState.mockReturnValue({
      accountId: 'acct-1',
      providerId: 'prov-1',
      redirectTo: '/home',
      nonce: 'n1',
      codeVerifier: 'cv1',
    });
    mockFetchOidcDiscovery.mockResolvedValue({
      ok: true,
      document: {
        issuer: PROVIDER_ROW.issuer,
        authorization_endpoint: 'https://idp.example.com/authorize',
        token_endpoint: 'https://idp.example.com/token',
        jwks_uri: 'https://idp.example.com/jwks',
      },
    });
    mockExchangeOidcCode.mockResolvedValue({
      ok: true,
      tokens: { id_token: 'signed.jwt' },
    });
    mockCreateOidcRemoteJwkSet.mockReturnValue(vi.fn());
    mockValidateOidcIdToken.mockResolvedValue({
      ok: true,
      claims: {
        sub: 'sub-1',
        email: 'user@example.com',
        emailVerified: true,
        name: 'User',
        payload: { sub: 'sub-1', groups: ['Engineering'] },
      },
    });
    mockMapSsoGroupsToRole.mockReturnValue({
      ok: true,
      role: 'member',
      matchedGroups: ['Engineering'],
      groups: ['Engineering'],
    });
    mockUpsertSsoUser.mockResolvedValue({
      id: 'user-1',
      role: 'viewer',
      email: 'user@example.com',
    });
    mockCreateSession.mockResolvedValue({
      token: 'session-token-abc',
      session: { id: 'sess-1' },
    });
  });

  it('rejects invalid state', async () => {
    mockVerifySsoState.mockReturnValue(null);
    const app = createApp();
    const res = await app.request('/api/auth/sso/prov-1/callback?code=c&state=bad', {
      headers: { Cookie: 'sso_state=bad.hmac' },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=invalid_state');
  });

  it('rejects when id_token signature validation fails', async () => {
    mockValidateOidcIdToken.mockResolvedValue({
      ok: false,
      reason: 'invalid_signature',
      message: 'bad sig',
    });
    const app = createApp();
    const res = await app.request('/api/auth/sso/prov-1/callback?code=c&state=s', {
      headers: { Cookie: 'sso_state=s.hmac' },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=id_token_invalid_signature');
  });

  it('rejects require_group_match failures', async () => {
    mockMapSsoGroupsToRole.mockReturnValue({
      ok: false,
      reason: 'require_group_match',
      message: 'no match',
      groups: [],
    });
    const app = createApp();
    const res = await app.request('/api/auth/sso/prov-1/callback?code=c&state=s', {
      headers: { Cookie: 'sso_state=s.hmac' },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=require_group_match');
  });

  it('re-checks entitlement on callback and fails closed', async () => {
    mockAccountHasSsoFeature.mockResolvedValue(false);
    const app = createApp();
    const res = await app.request('/api/auth/sso/prov-1/callback?code=c&state=s', {
      headers: { Cookie: 'sso_state=s.hmac' },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=entitlement_denied');
  });

  it('issues session cookie and redirects on success', async () => {
    const app = createApp();
    const res = await app.request('/api/auth/sso/prov-1/callback?code=c&state=s', {
      headers: { Cookie: 'sso_state=s.hmac' },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://app.example.com/home');
    const cookies =
      typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : [res.headers.get('Set-Cookie') ?? ''];
    const joined = cookies.join(';');
    expect(joined).toContain('revealui-session=session-token-abc');
    expect(joined).toContain('sso_state=');
    expect(mockCreateSession).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          authMethod: 'sso',
          ssoProviderId: 'prov-1',
          accountId: 'acct-1',
        }),
      }),
    );
  });

  it('returns provider_not_found when provider account mismatch on callback', async () => {
    mockSelectLimit.mockResolvedValue([]);
    const app = createApp();
    const res = await app.request('/api/auth/sso/prov-1/callback?code=c&state=s', {
      headers: { Cookie: 'sso_state=s.hmac' },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=provider_not_found');
  });
});
