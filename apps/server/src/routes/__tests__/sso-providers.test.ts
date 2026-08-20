import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAccountHasSsoFeature,
  mockMembershipLimit,
  mockProviderSelectLimit,
  mockProviderSelectWhere,
  mockInsertValues,
  mockUpdateWhere,
  mockFetchOidcDiscovery,
  mockParseIdpMetadataXml,
  mockFetchIdpMetadata,
  mockAuditSsoConfigChanged,
  mockDb,
} = vi.hoisted(() => {
  const mockMembershipLimit = vi.fn();
  const mockProviderSelectLimit = vi.fn();
  const mockProviderSelectWhere = vi.fn();
  const mockInsertValues = vi.fn();
  const mockUpdateWhere = vi.fn();

  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };

  return {
    mockAccountHasSsoFeature: vi.fn(),
    mockMembershipLimit,
    mockProviderSelectLimit,
    mockProviderSelectWhere,
    mockInsertValues,
    mockUpdateWhere,
    mockFetchOidcDiscovery: vi.fn(),
    mockParseIdpMetadataXml: vi.fn(),
    mockFetchIdpMetadata: vi.fn(),
    mockAuditSsoConfigChanged: vi.fn().mockResolvedValue(undefined),
    mockDb,
  };
});

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/account-entitlement.js', () => ({
  accountHasSsoFeature: (...args: unknown[]) => mockAccountHasSsoFeature(...args),
}));

vi.mock('../../middleware/entitlements.js', () => ({
  getEntitlementsFromContext: (c: { get: (key: string) => unknown }) =>
    c.get('entitlements') ?? {
      userId: null,
      accountId: null,
      membershipRole: null,
      subscriptionStatus: null,
      graceUntil: null,
      tier: 'free',
      features: {},
      limits: {},
      resolvedAt: new Date(),
    },
  entitlementMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock('@revealui/db', () => ({
  getClient: () => mockDb,
}));

vi.mock('@revealui/db/schema', () => ({
  accountMemberships: {
    accountId: 'accountMemberships.accountId',
    userId: 'accountMemberships.userId',
    role: 'accountMemberships.role',
    status: 'accountMemberships.status',
  },
  accountSsoProviders: {
    id: 'accountSsoProviders.id',
    accountId: 'accountSsoProviders.accountId',
    providerType: 'accountSsoProviders.providerType',
    name: 'accountSsoProviders.name',
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
    allowPasswordFallback: 'accountSsoProviders.allowPasswordFallback',
    createdAt: 'accountSsoProviders.createdAt',
    updatedAt: 'accountSsoProviders.updatedAt',
    deletedAt: 'accountSsoProviders.deletedAt',
  },
}));

vi.mock('@revealui/auth/server', () => ({
  fetchOidcDiscovery: (...args: unknown[]) => mockFetchOidcDiscovery(...args),
  parseIdpMetadataXml: (...args: unknown[]) => mockParseIdpMetadataXml(...args),
  fetchIdpMetadata: (...args: unknown[]) => mockFetchIdpMetadata(...args),
  auditSsoConfigChanged: (...args: unknown[]) => mockAuditSsoConfigChanged(...args),
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  eq: vi.fn((col: unknown, val: unknown) => ({ _eq: [col, val] })),
  isNull: vi.fn((col: unknown) => ({ _isNull: col })),
}));

import { Hono } from 'hono';
import type { HTTPException } from 'hono/http-exception';
import ssoProvidersRoute, {
  buildDiscoveryUrl,
  claimStructurePreview,
  isAllowedDefaultRole,
  isMutationRole,
} from '../sso-providers.js';

const USER = {
  id: 'user-1',
  email: 'owner@example.com',
  name: 'Owner',
  role: 'admin',
};

const PROVIDER_ROW = {
  id: 'sso_abc',
  accountId: 'acct-1',
  providerType: 'oidc',
  name: 'Okta',
  enabled: false,
  issuer: 'https://idp.example.com',
  discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration',
  clientId: 'client-1',
  clientSecretRef: 'REVEALUI_SSO_CLIENT_SECRET',
  samlMetadataUrl: null,
  samlMetadataXml: null,
  samlSpEntityId: null,
  signingCertPem: null,
  groupClaim: 'groups',
  groupRoleMap: { Engineering: 'member' },
  defaultRole: 'member',
  requireGroupMatch: false,
  allowPasswordFallback: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
};

const SAML_PROVIDER_ROW = {
  ...PROVIDER_ROW,
  id: 'sso_saml',
  providerType: 'saml',
  name: 'Azure SAML',
  issuer: 'https://sts.windows.net/tenant/',
  discoveryUrl: null,
  clientId: null,
  clientSecretRef: null,
  samlMetadataUrl: 'https://idp.example.com/metadata.xml',
  samlMetadataXml: null,
  samlSpEntityId: null,
  signingCertPem: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
};

function createApp(user: typeof USER | null = USER) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    c.set('entitlements', {
      userId: user?.id ?? null,
      accountId: 'acct-1',
      membershipRole: 'owner',
      subscriptionStatus: 'active',
      graceUntil: null,
      tier: 'enterprise',
      features: { sso: true },
      limits: {},
      resolvedAt: new Date(),
    });
    await next();
  });
  app.onError((err, c) => {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      const httpErr = err as HTTPException;
      return c.json({ error: httpErr.message }, httpErr.status);
    }
    return c.json({ error: 'Internal error' }, 500);
  });
  app.route('/api/accounts', ssoProvidersRoute);
  return app;
}

function wireMembership(role = 'owner') {
  mockMembershipLimit.mockResolvedValue([{ accountId: 'acct-1', role }]);
}

function wireProviderList(rows: unknown[] = [PROVIDER_ROW]) {
  // list path: select().from().where() → array (no limit)
  mockProviderSelectWhere.mockResolvedValue(rows);
  mockProviderSelectLimit.mockResolvedValue(rows.slice(0, 1));
}

function setupDbMocks() {
  mockDb.select.mockImplementation(() => {
    return {
      from: (table: { accountId?: string; userId?: string; issuer?: string }) => {
        const isMembership = table != null && 'userId' in table && !('issuer' in table);
        const whereFn = (...args: unknown[]) => {
          if (isMembership) {
            return {
              limit: (...limitArgs: unknown[]) => mockMembershipLimit(...limitArgs),
            };
          }
          return {
            limit: (...limitArgs: unknown[]) => mockProviderSelectLimit(...limitArgs),
            then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              Promise.resolve(mockProviderSelectWhere(...args)).then(resolve, reject),
          };
        };
        return { where: whereFn };
      },
    };
  });

  mockDb.insert.mockReturnValue({
    values: (...args: unknown[]) => mockInsertValues(...args),
  });
  mockDb.update.mockReturnValue({
    set: () => ({
      where: (...args: unknown[]) => mockUpdateWhere(...args),
    }),
  });
}

describe('pure helpers', () => {
  it('buildDiscoveryUrl uses discoveryUrl when set', () => {
    expect(buildDiscoveryUrl('https://idp.example.com/', 'https://custom/.well-known')).toBe(
      'https://custom/.well-known',
    );
  });

  it('buildDiscoveryUrl derives from issuer', () => {
    expect(buildDiscoveryUrl('https://idp.example.com/')).toBe(
      'https://idp.example.com/.well-known/openid-configuration',
    );
  });

  it('isAllowedDefaultRole / isMutationRole', () => {
    expect(isAllowedDefaultRole('member')).toBe(true);
    expect(isAllowedDefaultRole('owner')).toBe(false);
    expect(isMutationRole('owner')).toBe(true);
    expect(isMutationRole('member')).toBe(false);
  });

  it('claimStructurePreview includes group claim', () => {
    const preview = claimStructurePreview('roles');
    expect(preview.groupClaim).toBe('roles');
    expect(preview.standardClaims).toContain('sub');
  });
});

describe('SSO provider CRUD + entitlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMocks();
    mockAccountHasSsoFeature.mockResolvedValue(true);
    wireMembership('owner');
    wireProviderList([PROVIDER_ROW]);
    mockInsertValues.mockResolvedValue(undefined);
    mockUpdateWhere.mockResolvedValue(undefined);
    mockFetchOidcDiscovery.mockResolvedValue({
      ok: true,
      document: {
        issuer: 'https://idp.example.com',
        authorization_endpoint: 'https://idp.example.com/authorize',
        token_endpoint: 'https://idp.example.com/token',
        jwks_uri: 'https://idp.example.com/jwks',
        scopes_supported: ['openid', 'email', 'profile'],
      },
    });
  });

  it('returns 401 when unauthenticated', async () => {
    const app = createApp(null);
    const res = await app.request('/api/accounts/acct-1/sso-providers');
    expect(res.status).toBe(401);
  });

  it('returns 403 when sso feature is false', async () => {
    mockAccountHasSsoFeature.mockResolvedValue(false);
    const app = createApp();
    const res = await app.request('/api/accounts/acct-1/sso-providers');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/SSO is not enabled/i);
  });

  it('returns 404 on account mismatch (no membership)', async () => {
    mockMembershipLimit.mockResolvedValue([]);
    const app = createApp();
    const res = await app.request('/api/accounts/other-acct/sso-providers');
    expect(res.status).toBe(404);
  });

  it('lists providers for entitled member', async () => {
    // membership first via limit, then list via where promise
    mockMembershipLimit.mockResolvedValueOnce([{ accountId: 'acct-1', role: 'owner' }]);
    mockProviderSelectWhere.mockResolvedValueOnce([PROVIDER_ROW]);

    const app = createApp();
    const res = await app.request('/api/accounts/acct-1/sso-providers');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      providers: Array<{ id: string; clientSecretRef: string }>;
    };
    expect(body.providers).toHaveLength(1);
    expect(body.providers[0]?.id).toBe('sso_abc');
    // secret ref path only — never a resolved secret value
    expect(body.providers[0]?.clientSecretRef).toBe('REVEALUI_SSO_CLIENT_SECRET');
  });

  it('rejects mutation for non-owner non-admin membership', async () => {
    mockMembershipLimit.mockResolvedValue([{ accountId: 'acct-1', role: 'member' }]);
    const app = createApp();
    const res = await app.request('/api/accounts/acct-1/sso-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Okta',
        providerType: 'oidc',
        issuer: 'https://idp.example.com',
        clientId: 'c1',
      }),
    });
    expect(res.status).toBe(403);
  });

  it('creates an OIDC provider (disabled by default)', async () => {
    mockMembershipLimit.mockResolvedValue([{ accountId: 'acct-1', role: 'owner' }]);
    // after insert, loadProviderForAccount uses select limit
    mockProviderSelectLimit.mockResolvedValue([PROVIDER_ROW]);

    const app = createApp();
    const res = await app.request('/api/accounts/acct-1/sso-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Okta',
        providerType: 'oidc',
        issuer: 'https://idp.example.com',
        clientId: 'client-1',
        clientSecretRef: 'REVEALUI_SSO_CLIENT_SECRET',
      }),
    });
    expect(res.status).toBe(201);
    expect(mockInsertValues).toHaveBeenCalled();
    const insertArg = mockInsertValues.mock.calls[0]?.[0] as {
      enabled: boolean;
      clientSecretRef: string;
      providerType: string;
    };
    expect(insertArg.enabled).toBe(false);
    expect(insertArg.clientSecretRef).toBe('REVEALUI_SSO_CLIENT_SECRET');
    expect(insertArg.providerType).toBe('oidc');
    expect(mockAuditSsoConfigChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        accountId: 'acct-1',
        userId: 'user-1',
        issuer: 'https://idp.example.com',
        providerType: 'oidc',
      }),
    );
  });

  it('rejects SAML create without metadata', async () => {
    mockMembershipLimit.mockResolvedValue([{ accountId: 'acct-1', role: 'owner' }]);
    const app = createApp();
    const res = await app.request('/api/accounts/acct-1/sso-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Azure SAML',
        providerType: 'saml',
        issuer: 'https://login.microsoftonline.com/tenant',
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/metadata/i);
  });

  it('creates a SAML provider with metadata URL', async () => {
    mockMembershipLimit.mockResolvedValue([{ accountId: 'acct-1', role: 'owner' }]);
    mockProviderSelectLimit.mockResolvedValue([SAML_PROVIDER_ROW]);

    const app = createApp();
    const res = await app.request('/api/accounts/acct-1/sso-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Azure SAML',
        providerType: 'saml',
        issuer: 'https://sts.windows.net/tenant/',
        samlMetadataUrl: 'https://idp.example.com/metadata.xml',
      }),
    });
    expect(res.status).toBe(201);
    const insertArg = mockInsertValues.mock.calls[0]?.[0] as {
      providerType: string;
      samlMetadataUrl: string;
      clientId: string | null;
    };
    expect(insertArg.providerType).toBe('saml');
    expect(insertArg.samlMetadataUrl).toBe('https://idp.example.com/metadata.xml');
    expect(insertArg.clientId).toBeNull();
  });

  it('test-connection validates SAML metadata XML dry-run', async () => {
    mockMembershipLimit.mockResolvedValue([{ accountId: 'acct-1', role: 'owner' }]);
    mockParseIdpMetadataXml.mockReturnValue({
      ok: true,
      entityId: 'https://sts.windows.net/tenant/',
      entryPoint: 'https://login.microsoftonline.com/sso',
      idpCertPem: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
    });
    const app = createApp();
    const res = await app.request('/api/accounts/acct-1/sso-providers/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerType: 'saml',
        issuer: 'https://sts.windows.net/tenant/',
        samlMetadataXml: '<EntityDescriptor entityID="https://sts.windows.net/tenant/"/>',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      saml: { entityId: string; entryPoint: string };
    };
    expect(body.ok).toBe(true);
    expect(body.saml.entityId).toBe('https://sts.windows.net/tenant/');
    expect(body.saml.entryPoint).toBe('https://login.microsoftonline.com/sso');
    expect(mockParseIdpMetadataXml).toHaveBeenCalled();
    expect(mockFetchOidcDiscovery).not.toHaveBeenCalled();
  });

  it('returns 404 when provider id is not on the account', async () => {
    mockMembershipLimit.mockResolvedValue([{ accountId: 'acct-1', role: 'owner' }]);
    mockProviderSelectLimit.mockResolvedValue([]);
    const app = createApp();
    const res = await app.request('/api/accounts/acct-1/sso-providers/wrong-id');
    expect(res.status).toBe(404);
  });

  it('test-connection dry-runs discovery without creating a session', async () => {
    mockMembershipLimit.mockResolvedValue([{ accountId: 'acct-1', role: 'owner' }]);
    const app = createApp();
    const res = await app.request('/api/accounts/acct-1/sso-providers/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issuer: 'https://idp.example.com',
        groupClaim: 'groups',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      discovery: { jwksUri: string };
      claimStructurePreview: { groupClaim: string };
    };
    expect(body.ok).toBe(true);
    expect(body.discovery.jwksUri).toBe('https://idp.example.com/jwks');
    expect(body.claimStructurePreview.groupClaim).toBe('groups');
    expect(mockFetchOidcDiscovery).toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('test-connection returns ok:false on discovery failure', async () => {
    mockMembershipLimit.mockResolvedValue([{ accountId: 'acct-1', role: 'owner' }]);
    mockFetchOidcDiscovery.mockResolvedValue({
      ok: false,
      reason: 'fetch_failed',
      message: 'discovery HTTP 500',
    });
    const app = createApp();
    const res = await app.request('/api/accounts/acct-1/sso-providers/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issuer: 'https://idp.example.com' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; reason: string };
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('fetch_failed');
  });

  it('updates an OIDC provider and audits sso_config_changed', async () => {
    mockMembershipLimit.mockResolvedValue([{ accountId: 'acct-1', role: 'owner' }]);
    mockProviderSelectLimit.mockResolvedValue([PROVIDER_ROW]);
    const app = createApp();
    const res = await app.request('/api/accounts/acct-1/sso-providers/sso_abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Okta renamed', groupRoleMap: { Eng: 'editor' } }),
    });
    expect(res.status).toBe(200);
    expect(mockUpdateWhere).toHaveBeenCalled();
    expect(mockAuditSsoConfigChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        accountId: 'acct-1',
        providerId: 'sso_abc',
        userId: 'user-1',
        issuer: 'https://idp.example.com',
        providerType: 'oidc',
      }),
    );
  });

  it('soft-deletes a provider and audits sso_config_changed', async () => {
    mockMembershipLimit.mockResolvedValue([{ accountId: 'acct-1', role: 'owner' }]);
    mockProviderSelectLimit.mockResolvedValue([PROVIDER_ROW]);
    const app = createApp();
    const res = await app.request('/api/accounts/acct-1/sso-providers/sso_abc', {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    expect(mockUpdateWhere).toHaveBeenCalled();
    expect(mockAuditSsoConfigChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        accountId: 'acct-1',
        providerId: 'sso_abc',
        userId: 'user-1',
        issuer: 'https://idp.example.com',
        providerType: 'oidc',
      }),
    );
  });

  it('GET /current reports ssoFeature false when not entitled', async () => {
    mockAccountHasSsoFeature.mockResolvedValue(false);
    mockMembershipLimit.mockResolvedValue([{ accountId: 'acct-1', role: 'owner' }]);
    const app = createApp();
    const res = await app.request('/api/accounts/current');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accountId: string; ssoFeature: boolean };
    expect(body.accountId).toBe('acct-1');
    expect(body.ssoFeature).toBe(false);
  });
});
