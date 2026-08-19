/**
 * Account-scoped SSO provider admin API (GAP-464).
 *
 * GET    /accounts/current
 * GET    /accounts/:accountId/sso-providers
 * POST   /accounts/:accountId/sso-providers
 * GET    /accounts/:accountId/sso-providers/:providerId
 * PATCH  /accounts/:accountId/sso-providers/:providerId
 * DELETE /accounts/:accountId/sso-providers/:providerId
 * POST   /accounts/:accountId/sso-providers/test-connection
 * POST   /accounts/:accountId/sso-providers/:providerId/test-connection
 *
 * Mounted at /api and /api/v1 so paths are /api/accounts/...
 *
 * Security hardlines:
 * - Auth required
 * - Membership on path accountId (never trust path alone)
 * - accountHasSsoFeature fail-closed → 403
 * - Provider rows always selected/updated with accountId + id
 * - client_secret_ref stored as path string only; never resolved or logged
 * - Mutations require owner/admin membership role
 */

import { randomUUID } from 'node:crypto';
import {
  auditSsoConfigChanged,
  fetchIdpMetadata,
  fetchOidcDiscovery,
  parseIdpMetadataXml,
} from '@revealui/auth/server';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { accountMemberships, accountSsoProviders } from '@revealui/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { accountHasSsoFeature } from '../lib/account-entitlement.js';
import { getEntitlementsFromContext } from '../middleware/entitlements.js';

const app = new Hono();

const ALLOWED_DEFAULT_ROLES = new Set(['viewer', 'member', 'editor', 'admin']);
const MUTATION_ROLES = new Set(['owner', 'admin']);

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

interface MembershipRow {
  accountId: string;
  role: string;
}

interface ProviderPublic {
  id: string;
  accountId: string;
  providerType: 'oidc' | 'saml';
  name: string;
  enabled: boolean;
  issuer: string;
  discoveryUrl: string | null;
  clientId: string | null;
  /** Vault path / env var name only — never a resolved secret */
  clientSecretRef: string | null;
  samlMetadataUrl: string | null;
  samlMetadataXml: string | null;
  samlSpEntityId: string | null;
  /** Present when stored; never return PEM body contents as a secret — PEM is IdP public cert */
  hasSigningCert: boolean;
  groupClaim: string;
  groupRoleMap: Record<string, string>;
  defaultRole: string;
  requireGroupMatch: boolean;
  allowPasswordFallback: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateBody {
  name?: unknown;
  providerType?: unknown;
  issuer?: unknown;
  discoveryUrl?: unknown;
  clientId?: unknown;
  clientSecretRef?: unknown;
  samlMetadataUrl?: unknown;
  samlMetadataXml?: unknown;
  samlSpEntityId?: unknown;
  signingCertPem?: unknown;
  groupClaim?: unknown;
  groupRoleMap?: unknown;
  defaultRole?: unknown;
  requireGroupMatch?: unknown;
  allowPasswordFallback?: unknown;
  enabled?: unknown;
}

interface UpdateBody extends CreateBody {}

interface TestConnectionBody {
  providerType?: unknown;
  issuer?: unknown;
  discoveryUrl?: unknown;
  groupClaim?: unknown;
  providerId?: unknown;
  samlMetadataUrl?: unknown;
  samlMetadataXml?: unknown;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

export function buildDiscoveryUrl(issuer: string, discoveryUrl?: string | null): string {
  if (discoveryUrl && discoveryUrl.trim().length > 0) {
    return discoveryUrl.trim();
  }
  const base = issuer.replace(/\/+$/, '');
  return `${base}/.well-known/openid-configuration`;
}

export function isAllowedDefaultRole(role: string): boolean {
  return ALLOWED_DEFAULT_ROLES.has(role);
}

export function isMutationRole(role: string): boolean {
  return MUTATION_ROLES.has(role);
}

export function claimStructurePreview(groupClaim: string): {
  standardClaims: string[];
  groupClaim: string;
  notes: string[];
} {
  return {
    standardClaims: ['sub', 'iss', 'aud', 'exp', 'iat', 'email', 'email_verified', 'name'],
    groupClaim,
    notes: [
      'Dry-run discovery does not issue tokens. Claim values appear only after a real SSO login.',
      `Groups are read from the "${groupClaim}" claim when mapping roles.`,
    ],
  };
}

function requireUser(c: { get: (key: string) => unknown }): UserContext {
  const user = c.get('user') as UserContext | undefined;
  if (!user?.id) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  return user;
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HTTPException(400, { message: `${field} is required` });
  }
  return value.trim();
}

function asOptionalString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new HTTPException(400, { message: 'Expected string or null' });
  }
  return value.trim();
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new HTTPException(400, { message: 'Expected boolean' });
  }
  return value;
}

function asGroupRoleMap(value: unknown): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new HTTPException(400, { message: 'groupRoleMap must be an object' });
  }
  const out: Record<string, string> = {};
  for (const [key, mapped] of Object.entries(value as Record<string, unknown>)) {
    if (typeof mapped !== 'string' || mapped.trim().length === 0) {
      throw new HTTPException(400, { message: 'groupRoleMap values must be non-empty strings' });
    }
    if (!isAllowedDefaultRole(mapped.trim()) && mapped.trim() !== 'owner') {
      throw new HTTPException(400, {
        message: `groupRoleMap role "${mapped}" is not allowed`,
      });
    }
    // Never allow map values of owner via untrusted config? Spec: never grant admin
    // from unmapped groups. Explicit map to admin is allowed. Owner is account-level
    // and should not come from IdP maps in MVP.
    if (mapped.trim() === 'owner') {
      throw new HTTPException(400, { message: 'groupRoleMap cannot assign owner' });
    }
    out[key] = mapped.trim();
  }
  return out;
}

function toPublic(row: {
  id: string;
  accountId: string;
  providerType: string;
  name: string;
  enabled: boolean;
  issuer: string;
  discoveryUrl: string | null;
  clientId: string | null;
  clientSecretRef: string | null;
  samlMetadataUrl?: string | null;
  samlMetadataXml?: string | null;
  samlSpEntityId?: string | null;
  signingCertPem?: string | null;
  groupClaim: string;
  groupRoleMap: unknown;
  defaultRole: string;
  requireGroupMatch: boolean;
  allowPasswordFallback: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ProviderPublic {
  const signing = row.signingCertPem?.trim() ?? '';
  return {
    id: row.id,
    accountId: row.accountId,
    providerType: row.providerType as 'oidc' | 'saml',
    name: row.name,
    enabled: row.enabled,
    issuer: row.issuer,
    discoveryUrl: row.discoveryUrl,
    clientId: row.clientId,
    clientSecretRef: row.clientSecretRef,
    samlMetadataUrl: row.samlMetadataUrl ?? null,
    // Return XML so admins can re-edit; it is IdP public metadata, not a secret
    samlMetadataXml: row.samlMetadataXml ?? null,
    samlSpEntityId: row.samlSpEntityId ?? null,
    hasSigningCert: signing.length > 0,
    groupClaim: row.groupClaim,
    groupRoleMap: (row.groupRoleMap ?? {}) as Record<string, string>,
    defaultRole: row.defaultRole,
    requireGroupMatch: row.requireGroupMatch,
    allowPasswordFallback: row.allowPasswordFallback,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function asProviderType(value: unknown, fallback: 'oidc' | 'saml' = 'oidc'): 'oidc' | 'saml' {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : fallback;
  if (raw === 'oidc' || raw === 'saml') return raw;
  throw new HTTPException(400, { message: 'providerType must be oidc or saml' });
}

function requireSamlMetadata(metadataUrl: string | null, metadataXml: string | null): void {
  if (!(metadataUrl || metadataXml)) {
    throw new HTTPException(400, {
      message: 'SAML providers require samlMetadataUrl or samlMetadataXml',
    });
  }
}

async function loadMembership(userId: string, accountId: string): Promise<MembershipRow | null> {
  const db = getClient();
  const [row] = await db
    .select({
      accountId: accountMemberships.accountId,
      role: accountMemberships.role,
    })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.userId, userId),
        eq(accountMemberships.accountId, accountId),
        eq(accountMemberships.status, 'active'),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Auth + membership + SSO entitlement for path accountId.
 * Returns membership role when authorized.
 */
async function authorizeAccountAccess(
  c: { get: (key: string) => unknown },
  accountId: string,
  opts: { mutation: boolean },
): Promise<{ user: UserContext; membership: MembershipRow }> {
  const user = requireUser(c);
  if (!accountId || accountId.trim().length === 0) {
    throw new HTTPException(400, { message: 'accountId is required' });
  }

  const membership = await loadMembership(user.id, accountId);
  if (!membership) {
    // Account mismatch / non-member: do not leak existence
    throw new HTTPException(404, { message: 'Account not found' });
  }

  if (opts.mutation && !isMutationRole(membership.role)) {
    throw new HTTPException(403, {
      message: 'Only account owners and admins can manage SSO providers',
    });
  }

  const db = getClient();
  const entitled = await accountHasSsoFeature(db, accountId);
  if (!entitled) {
    throw new HTTPException(403, { message: 'SSO is not enabled for this account' });
  }

  return { user, membership };
}

async function loadProviderForAccount(
  providerId: string,
  accountId: string,
): Promise<ReturnType<typeof toPublic> | null> {
  const db = getClient();
  const [row] = await db
    .select()
    .from(accountSsoProviders)
    .where(
      and(
        eq(accountSsoProviders.id, providerId),
        eq(accountSsoProviders.accountId, accountId),
        isNull(accountSsoProviders.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  return toPublic(row);
}

async function logConfigChange(
  action: string,
  fields: {
    accountId: string;
    providerId?: string;
    userId: string;
    issuer?: string;
    providerType?: string;
  },
): Promise<void> {
  logger.info('sso_config_changed', {
    event: 'sso_config_changed',
    action,
    accountId: fields.accountId,
    providerId: fields.providerId,
    userId: fields.userId,
    issuer: fields.issuer,
    providerType: fields.providerType,
    // Never log clientSecretRef resolved values; ref path is ok if needed later
  });
  await auditSsoConfigChanged({
    action,
    accountId: fields.accountId,
    providerId: fields.providerId,
    userId: fields.userId,
    issuer: fields.issuer,
    providerType: fields.providerType,
  });
}

// ---------------------------------------------------------------------------
// GET /current — resolve caller's account for admin UI bootstrap
// ---------------------------------------------------------------------------

app.get('/current', async (c) => {
  const user = requireUser(c);
  const entitlements = getEntitlementsFromContext(c);
  const accountId = entitlements.accountId;

  if (!accountId) {
    return c.json(
      {
        accountId: null,
        membershipRole: null,
        ssoFeature: false,
      },
      200,
    );
  }

  // Re-check membership + entitlement explicitly (fail closed on race)
  const membership = await loadMembership(user.id, accountId);
  if (!membership) {
    return c.json(
      {
        accountId: null,
        membershipRole: null,
        ssoFeature: false,
      },
      200,
    );
  }

  const db = getClient();
  const ssoFeature = await accountHasSsoFeature(db, accountId);

  return c.json(
    {
      accountId,
      membershipRole: membership.role,
      ssoFeature,
    },
    200,
  );
});

// ---------------------------------------------------------------------------
// POST /:accountId/sso-providers/test-connection (before :providerId routes)
// ---------------------------------------------------------------------------

async function runOidcTestConnection(
  issuer: string,
  discoveryUrl: string | null,
  groupClaim: string,
): Promise<Record<string, unknown>> {
  const url = buildDiscoveryUrl(issuer, discoveryUrl);
  const result = await fetchOidcDiscovery(url, { expectedIssuer: issuer });

  if (!result.ok) {
    return {
      ok: false as const,
      reason: result.reason,
      message: result.message,
      discoveryUrl: url,
    };
  }

  const doc = result.document;
  return {
    ok: true as const,
    discoveryUrl: url,
    discovery: {
      issuer: doc.issuer,
      authorizationEndpoint: doc.authorization_endpoint,
      tokenEndpoint: doc.token_endpoint,
      jwksUri: doc.jwks_uri,
      userinfoEndpoint: doc.userinfo_endpoint ?? null,
      endSessionEndpoint: doc.end_session_endpoint ?? null,
      scopesSupported: doc.scopes_supported ?? [],
      responseTypesSupported: doc.response_types_supported ?? [],
      codeChallengeMethodsSupported: doc.code_challenge_methods_supported ?? [],
    },
    claimStructurePreview: claimStructurePreview(groupClaim),
  };
}

async function runSamlTestConnection(
  issuer: string,
  metadataUrl: string | null,
  metadataXml: string | null,
  groupClaim: string,
): Promise<Record<string, unknown>> {
  if (!(metadataUrl || metadataXml)) {
    throw new HTTPException(400, {
      message: 'samlMetadataUrl or samlMetadataXml is required for SAML test connection',
    });
  }

  const parsed = metadataXml
    ? parseIdpMetadataXml(metadataXml)
    : await fetchIdpMetadata(metadataUrl as string);

  if (!parsed.ok) {
    return {
      ok: false as const,
      reason: parsed.reason,
      message: parsed.message,
      metadataUrl: metadataUrl ?? undefined,
    };
  }

  const issuerMismatch =
    issuer.length > 0 &&
    parsed.entityId.length > 0 &&
    issuer.replace(/\/+$/, '') !== parsed.entityId.replace(/\/+$/, '');

  return {
    ok: true as const,
    metadataUrl: metadataUrl ?? null,
    saml: {
      entityId: parsed.entityId,
      entryPoint: parsed.entryPoint,
      hasSigningCert: true,
      issuerMatchesMetadata: !issuerMismatch,
    },
    claimStructurePreview: claimStructurePreview(groupClaim),
    ...(issuerMismatch
      ? {
          warning:
            'Configured issuer does not match IdP metadata entityID. Update issuer to the entityID before enabling.',
        }
      : {}),
  };
}

app.post('/:accountId/sso-providers/test-connection', async (c) => {
  const accountId = c.req.param('accountId');
  await authorizeAccountAccess(c, accountId, { mutation: true });

  let body: TestConnectionBody = {};
  try {
    body = (await c.req.json()) as TestConnectionBody;
  } catch {
    body = {};
  }

  let providerType: 'oidc' | 'saml' = asProviderType(body.providerType ?? 'oidc');
  let issuer = typeof body.issuer === 'string' ? body.issuer.trim() : '';
  let discoveryUrl =
    typeof body.discoveryUrl === 'string' && body.discoveryUrl.trim().length > 0
      ? body.discoveryUrl.trim()
      : null;
  let samlMetadataUrl =
    typeof body.samlMetadataUrl === 'string' && body.samlMetadataUrl.trim().length > 0
      ? body.samlMetadataUrl.trim()
      : null;
  let samlMetadataXml =
    typeof body.samlMetadataXml === 'string' && body.samlMetadataXml.trim().length > 0
      ? body.samlMetadataXml.trim()
      : null;
  let groupClaim =
    typeof body.groupClaim === 'string' && body.groupClaim.trim().length > 0
      ? body.groupClaim.trim()
      : 'groups';

  const providerId =
    typeof body.providerId === 'string' && body.providerId.trim().length > 0
      ? body.providerId.trim()
      : null;

  if (providerId) {
    const existing = await loadProviderForAccount(providerId, accountId);
    if (!existing) {
      throw new HTTPException(404, { message: 'SSO provider not found' });
    }
    providerType = existing.providerType;
    if (!issuer) issuer = existing.issuer;
    if (!discoveryUrl) discoveryUrl = existing.discoveryUrl;
    if (!samlMetadataUrl) samlMetadataUrl = existing.samlMetadataUrl;
    if (!samlMetadataXml) samlMetadataXml = existing.samlMetadataXml;
    if (groupClaim === 'groups' && existing.groupClaim) groupClaim = existing.groupClaim;
  }

  if (!issuer) {
    throw new HTTPException(400, { message: 'issuer is required for test connection' });
  }

  if (providerType === 'saml') {
    return c.json(
      await runSamlTestConnection(issuer, samlMetadataUrl, samlMetadataXml, groupClaim),
      200,
    );
  }

  return c.json(await runOidcTestConnection(issuer, discoveryUrl, groupClaim), 200);
});

// ---------------------------------------------------------------------------
// POST /:accountId/sso-providers/:providerId/test-connection
// ---------------------------------------------------------------------------

app.post('/:accountId/sso-providers/:providerId/test-connection', async (c) => {
  const accountId = c.req.param('accountId');
  const providerId = c.req.param('providerId');
  await authorizeAccountAccess(c, accountId, { mutation: true });

  const existing = await loadProviderForAccount(providerId, accountId);
  if (!existing) {
    throw new HTTPException(404, { message: 'SSO provider not found' });
  }

  if (existing.providerType === 'saml') {
    return c.json(
      await runSamlTestConnection(
        existing.issuer,
        existing.samlMetadataUrl,
        existing.samlMetadataXml,
        existing.groupClaim,
      ),
      200,
    );
  }

  return c.json(
    await runOidcTestConnection(existing.issuer, existing.discoveryUrl, existing.groupClaim),
    200,
  );
});

// ---------------------------------------------------------------------------
// GET /:accountId/sso-providers
// ---------------------------------------------------------------------------

app.get('/:accountId/sso-providers', async (c) => {
  const accountId = c.req.param('accountId');
  await authorizeAccountAccess(c, accountId, { mutation: false });

  const db = getClient();
  const rows = await db
    .select()
    .from(accountSsoProviders)
    .where(
      and(eq(accountSsoProviders.accountId, accountId), isNull(accountSsoProviders.deletedAt)),
    );

  return c.json({ providers: rows.map(toPublic) }, 200);
});

// ---------------------------------------------------------------------------
// POST /:accountId/sso-providers
// ---------------------------------------------------------------------------

app.post('/:accountId/sso-providers', async (c) => {
  const accountId = c.req.param('accountId');
  const { user } = await authorizeAccountAccess(c, accountId, { mutation: true });

  let body: CreateBody;
  try {
    body = (await c.req.json()) as CreateBody;
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  }

  const name = asNonEmptyString(body.name, 'name');
  const providerType = asProviderType(body.providerType ?? 'oidc');

  const issuer = asNonEmptyString(body.issuer, 'issuer');
  const discoveryUrl = asOptionalString(body.discoveryUrl);
  const clientId = asOptionalString(body.clientId);
  const clientSecretRef = asOptionalString(body.clientSecretRef);
  const samlMetadataUrl = asOptionalString(body.samlMetadataUrl);
  const samlMetadataXml = asOptionalString(body.samlMetadataXml);
  const samlSpEntityId = asOptionalString(body.samlSpEntityId);
  const signingCertPem = asOptionalString(body.signingCertPem);
  if (providerType === 'saml') {
    requireSamlMetadata(samlMetadataUrl, samlMetadataXml);
  }
  const groupClaim =
    typeof body.groupClaim === 'string' && body.groupClaim.trim().length > 0
      ? body.groupClaim.trim()
      : 'groups';
  const groupRoleMap = asGroupRoleMap(body.groupRoleMap);
  const defaultRole =
    typeof body.defaultRole === 'string' && body.defaultRole.trim().length > 0
      ? body.defaultRole.trim()
      : 'member';
  if (!isAllowedDefaultRole(defaultRole)) {
    throw new HTTPException(400, { message: `defaultRole "${defaultRole}" is not allowed` });
  }
  const requireGroupMatch = asBoolean(body.requireGroupMatch, false);
  const allowPasswordFallback = asBoolean(body.allowPasswordFallback, false);
  // Default disabled until test-connection succeeds (UI); server allows explicit true
  const enabled = asBoolean(body.enabled, false);

  const id = `sso_${randomUUID().replace(/-/g, '')}`;
  const db = getClient();

  try {
    await db.insert(accountSsoProviders).values({
      id,
      accountId,
      providerType,
      name,
      enabled,
      issuer,
      discoveryUrl: providerType === 'oidc' ? discoveryUrl : null,
      clientId: providerType === 'oidc' ? clientId : null,
      clientSecretRef: providerType === 'oidc' ? clientSecretRef : null,
      samlMetadataUrl: providerType === 'saml' ? samlMetadataUrl : null,
      samlMetadataXml: providerType === 'saml' ? samlMetadataXml : null,
      samlSpEntityId: providerType === 'saml' ? samlSpEntityId : null,
      signingCertPem: providerType === 'saml' ? signingCertPem : null,
      groupClaim,
      groupRoleMap,
      defaultRole,
      requireGroupMatch,
      allowPasswordFallback,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('account_sso_providers_account_issuer_active_idx') ||
      message.includes('unique')
    ) {
      throw new HTTPException(409, {
        message: 'An SSO provider with this issuer already exists for the account',
      });
    }
    throw err;
  }

  const created = await loadProviderForAccount(id, accountId);
  if (!created) {
    throw new HTTPException(500, { message: 'Failed to load created provider' });
  }

  await logConfigChange('create', {
    accountId,
    providerId: id,
    userId: user.id,
    issuer,
    providerType: created.providerType,
  });

  return c.json({ provider: created }, 201);
});

// ---------------------------------------------------------------------------
// GET /:accountId/sso-providers/:providerId
// ---------------------------------------------------------------------------

app.get('/:accountId/sso-providers/:providerId', async (c) => {
  const accountId = c.req.param('accountId');
  const providerId = c.req.param('providerId');
  await authorizeAccountAccess(c, accountId, { mutation: false });

  const provider = await loadProviderForAccount(providerId, accountId);
  if (!provider) {
    throw new HTTPException(404, { message: 'SSO provider not found' });
  }
  return c.json({ provider }, 200);
});

// ---------------------------------------------------------------------------
// PATCH /:accountId/sso-providers/:providerId
// ---------------------------------------------------------------------------

app.patch('/:accountId/sso-providers/:providerId', async (c) => {
  const accountId = c.req.param('accountId');
  const providerId = c.req.param('providerId');
  const { user } = await authorizeAccountAccess(c, accountId, { mutation: true });

  const existing = await loadProviderForAccount(providerId, accountId);
  if (!existing) {
    throw new HTTPException(404, { message: 'SSO provider not found' });
  }

  let body: UpdateBody;
  try {
    body = (await c.req.json()) as UpdateBody;
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  }

  // providerType is immutable after create (avoid half-migrated OIDC/SAML rows)
  if (body.providerType !== undefined) {
    const pt = asProviderType(body.providerType);
    if (pt !== existing.providerType) {
      throw new HTTPException(400, {
        message: 'providerType cannot be changed after create; remove and re-add the provider',
      });
    }
  }

  const patch: Partial<{
    name: string;
    enabled: boolean;
    issuer: string;
    discoveryUrl: string | null;
    clientId: string | null;
    clientSecretRef: string | null;
    samlMetadataUrl: string | null;
    samlMetadataXml: string | null;
    samlSpEntityId: string | null;
    signingCertPem: string | null;
    groupClaim: string;
    groupRoleMap: Record<string, string>;
    defaultRole: string;
    requireGroupMatch: boolean;
    allowPasswordFallback: boolean;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (body.name !== undefined) patch.name = asNonEmptyString(body.name, 'name');
  if (body.issuer !== undefined) patch.issuer = asNonEmptyString(body.issuer, 'issuer');
  if (body.discoveryUrl !== undefined) patch.discoveryUrl = asOptionalString(body.discoveryUrl);
  if (body.clientId !== undefined) patch.clientId = asOptionalString(body.clientId);
  if (body.clientSecretRef !== undefined) {
    patch.clientSecretRef = asOptionalString(body.clientSecretRef);
  }
  if (body.samlMetadataUrl !== undefined) {
    patch.samlMetadataUrl = asOptionalString(body.samlMetadataUrl);
  }
  if (body.samlMetadataXml !== undefined) {
    patch.samlMetadataXml = asOptionalString(body.samlMetadataXml);
  }
  if (body.samlSpEntityId !== undefined) {
    patch.samlSpEntityId = asOptionalString(body.samlSpEntityId);
  }
  if (body.signingCertPem !== undefined) {
    patch.signingCertPem = asOptionalString(body.signingCertPem);
  }
  if (body.groupClaim !== undefined) {
    patch.groupClaim = asNonEmptyString(body.groupClaim, 'groupClaim');
  }
  if (body.groupRoleMap !== undefined) patch.groupRoleMap = asGroupRoleMap(body.groupRoleMap);
  if (body.defaultRole !== undefined) {
    const role = asNonEmptyString(body.defaultRole, 'defaultRole');
    if (!isAllowedDefaultRole(role)) {
      throw new HTTPException(400, { message: `defaultRole "${role}" is not allowed` });
    }
    patch.defaultRole = role;
  }
  if (body.requireGroupMatch !== undefined) {
    patch.requireGroupMatch = asBoolean(body.requireGroupMatch, false);
  }
  if (body.allowPasswordFallback !== undefined) {
    patch.allowPasswordFallback = asBoolean(body.allowPasswordFallback, false);
  }
  if (body.enabled !== undefined) {
    patch.enabled = asBoolean(body.enabled, false);
  }

  if (existing.providerType === 'saml') {
    const nextUrl =
      patch.samlMetadataUrl !== undefined ? patch.samlMetadataUrl : existing.samlMetadataUrl;
    const nextXml =
      patch.samlMetadataXml !== undefined ? patch.samlMetadataXml : existing.samlMetadataXml;
    requireSamlMetadata(nextUrl, nextXml);
  }

  const db = getClient();
  try {
    await db
      .update(accountSsoProviders)
      .set(patch)
      .where(
        and(
          eq(accountSsoProviders.id, providerId),
          eq(accountSsoProviders.accountId, accountId),
          isNull(accountSsoProviders.deletedAt),
        ),
      );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('account_sso_providers_account_issuer_active_idx') ||
      message.includes('unique')
    ) {
      throw new HTTPException(409, {
        message: 'An SSO provider with this issuer already exists for the account',
      });
    }
    throw err;
  }

  const updated = await loadProviderForAccount(providerId, accountId);
  if (!updated) {
    throw new HTTPException(404, { message: 'SSO provider not found' });
  }

  await logConfigChange('update', {
    accountId,
    providerId,
    userId: user.id,
    issuer: updated.issuer,
    providerType: updated.providerType,
  });

  return c.json({ provider: updated }, 200);
});

// ---------------------------------------------------------------------------
// DELETE /:accountId/sso-providers/:providerId (soft delete)
// ---------------------------------------------------------------------------

app.delete('/:accountId/sso-providers/:providerId', async (c) => {
  const accountId = c.req.param('accountId');
  const providerId = c.req.param('providerId');
  const { user } = await authorizeAccountAccess(c, accountId, { mutation: true });

  const existing = await loadProviderForAccount(providerId, accountId);
  if (!existing) {
    throw new HTTPException(404, { message: 'SSO provider not found' });
  }

  const db = getClient();
  const now = new Date();
  await db
    .update(accountSsoProviders)
    .set({ deletedAt: now, enabled: false, updatedAt: now })
    .where(
      and(
        eq(accountSsoProviders.id, providerId),
        eq(accountSsoProviders.accountId, accountId),
        isNull(accountSsoProviders.deletedAt),
      ),
    );

  await logConfigChange('delete', {
    accountId,
    providerId,
    userId: user.id,
    issuer: existing.issuer,
    providerType: existing.providerType,
  });

  return c.json({ ok: true }, 200);
});

export default app;
