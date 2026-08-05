/**
 * Enterprise SSO OIDC routes (GAP-464 Phase 2 residual).
 *
 * GET /sso/:providerId/init?accountId=&redirectTo=
 * GET /sso/:providerId/callback
 *
 * Mounted at /api/auth (and /api/v1/auth) so paths are /api/auth/sso/...
 *
 * Security hardlines:
 * - Provider load is always account-scoped (id + accountId + enabled + oidc)
 * - accountHasSsoFeature on init and callback (fail closed)
 * - Signed sso_state cookie (HMAC via REVEALUI_SECRET)
 * - id_token signature validation required (never skip)
 * - Open-redirect: only relative paths starting with /
 * - Client secrets from env refs only; never logged
 */

import {
  buildOidcAuthorizationUrl,
  createOidcRemoteJwkSet,
  createSession,
  exchangeOidcCode,
  fetchOidcDiscovery,
  generateSsoState,
  mapSsoGroupsToRole,
  upsertSsoUser,
  validateOidcIdToken,
  verifySsoState,
} from '@revealui/auth/server';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { accountSsoProviders } from '@revealui/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { accountHasSsoFeature } from '../lib/account-entitlement.js';
import { resolveSelfApiBaseUrl } from '../lib/self-api-url.js';

const app = new Hono();

const SSO_STATE_COOKIE = 'sso_state';
const SESSION_COOKIE = 'revealui-session';
const ROLE_COOKIE = 'revealui-role';
const SSO_STATE_MAX_AGE = 300;

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Open-redirect safe path: only same-origin relative paths starting with `/`.
 * Rejects `//evil.com`, scheme-bearing strings, and backslash tricks.
 */
export function safeSsoRedirectPath(redirectTo: string | null | undefined): string {
  if (!redirectTo || typeof redirectTo !== 'string') return '/';
  const trimmed = redirectTo.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/';
  if (trimmed.includes('://') || trimmed.includes('\\')) return '/';
  // Reject control characters
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code < 32 || code === 127) return '/';
  }
  return trimmed;
}

/**
 * Resolve OIDC client_secret from env.
 * Prefer `clientSecretRef` as env var name, then
 * `REVEALUI_SSO_CLIENT_SECRET_<providerId>`, then `REVEALUI_SSO_CLIENT_SECRET`.
 * Never logs the value.
 */
export function resolveSsoClientSecret(provider: {
  id: string;
  clientSecretRef: string | null;
}): string | null {
  if (provider.clientSecretRef) {
    const ref = provider.clientSecretRef.trim();
    if (ref.length > 0) {
      const fromRef = process.env[ref];
      if (typeof fromRef === 'string' && fromRef.length > 0) return fromRef;
    }
  }
  const byId = process.env[`REVEALUI_SSO_CLIENT_SECRET_${provider.id}`];
  if (typeof byId === 'string' && byId.length > 0) return byId;
  const fallback = process.env.REVEALUI_SSO_CLIENT_SECRET;
  if (typeof fallback === 'string' && fallback.length > 0) return fallback;
  return null;
}

function cookieAttrs(maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function sessionCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;
  return process.env.SESSION_COOKIE_DOMAIN || undefined;
}

function setCookieHeader(name: string, value: string, maxAge: number, domain?: string): string {
  const domainPart = domain ? `; Domain=${domain}` : '';
  return `${name}=${value}; ${cookieAttrs(maxAge)}${domainPart}`;
}

function clearCookieHeader(name: string, domain?: string): string {
  const domainPart = domain ? `; Domain=${domain}` : '';
  return `${name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${domainPart}`;
}

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) {
      return trimmed.slice(eq + 1);
    }
  }
  return undefined;
}

function publicAppBaseUrl(): string {
  return (
    process.env.REVEALUI_PUBLIC_SERVER_URL?.replace(/\/+$/, '') ||
    process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/+$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ||
    'http://localhost:4000'
  );
}

function apiBaseUrl(): string {
  const self = resolveSelfApiBaseUrl();
  if (self) return self;
  return publicAppBaseUrl();
}

function loginErrorRedirect(reason: string): Response {
  const url = new URL('/login', publicAppBaseUrl());
  url.searchParams.set('error', reason);
  return Response.redirect(url.toString(), 302);
}

function appendSetCookie(headers: Headers, value: string): void {
  headers.append('Set-Cookie', value);
}

interface LoadedSsoProvider {
  id: string;
  accountId: string;
  providerType: string;
  enabled: boolean;
  issuer: string;
  discoveryUrl: string | null;
  clientId: string | null;
  clientSecretRef: string | null;
  groupClaim: string;
  groupRoleMap: Record<string, string>;
  defaultRole: string;
  requireGroupMatch: boolean;
}

async function loadEnabledOidcProvider(
  providerId: string,
  accountId: string,
): Promise<LoadedSsoProvider | null> {
  const db = getClient();
  const [row] = await db
    .select({
      id: accountSsoProviders.id,
      accountId: accountSsoProviders.accountId,
      providerType: accountSsoProviders.providerType,
      enabled: accountSsoProviders.enabled,
      issuer: accountSsoProviders.issuer,
      discoveryUrl: accountSsoProviders.discoveryUrl,
      clientId: accountSsoProviders.clientId,
      clientSecretRef: accountSsoProviders.clientSecretRef,
      groupClaim: accountSsoProviders.groupClaim,
      groupRoleMap: accountSsoProviders.groupRoleMap,
      defaultRole: accountSsoProviders.defaultRole,
      requireGroupMatch: accountSsoProviders.requireGroupMatch,
    })
    .from(accountSsoProviders)
    .where(
      and(
        eq(accountSsoProviders.id, providerId),
        eq(accountSsoProviders.accountId, accountId),
        eq(accountSsoProviders.enabled, true),
        eq(accountSsoProviders.providerType, 'oidc'),
        isNull(accountSsoProviders.deletedAt),
      ),
    )
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    groupRoleMap: (row.groupRoleMap ?? {}) as Record<string, string>,
  };
}

function discoveryUrlFor(provider: LoadedSsoProvider): string {
  if (provider.discoveryUrl && provider.discoveryUrl.length > 0) {
    return provider.discoveryUrl;
  }
  const issuer = provider.issuer.replace(/\/+$/, '');
  return `${issuer}/.well-known/openid-configuration`;
}

function clientIp(c: {
  req: { header: (name: string) => string | undefined };
}): string | undefined {
  return (
    c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || undefined
  );
}

// ---------------------------------------------------------------------------
// GET /sso/:providerId/init
// ---------------------------------------------------------------------------

app.get('/sso/:providerId/init', async (c) => {
  const providerId = c.req.param('providerId');
  const accountId = c.req.query('accountId');
  const redirectTo = safeSsoRedirectPath(c.req.query('redirectTo') ?? '/');

  if (!accountId || accountId.length === 0) {
    logger.warn('sso_login_failure', {
      event: 'sso_login_failure',
      reason: 'missing_account_id',
      providerId,
    });
    return c.json({ error: 'accountId query parameter is required' }, 400);
  }

  const provider = await loadEnabledOidcProvider(providerId, accountId);
  if (!provider) {
    logger.warn('sso_login_failure', {
      event: 'sso_login_failure',
      reason: 'provider_not_found',
      providerId,
      accountId,
    });
    return c.json({ error: 'SSO provider not found' }, 404);
  }

  const db = getClient();
  const entitled = await accountHasSsoFeature(db, accountId);
  if (!entitled) {
    logger.warn('sso_login_failure', {
      event: 'sso_login_failure',
      reason: 'entitlement_denied',
      providerId,
      accountId,
    });
    return c.json({ error: 'SSO is not enabled for this account' }, 403);
  }

  if (!provider.clientId) {
    logger.warn('sso_login_failure', {
      event: 'sso_login_failure',
      reason: 'missing_client_id',
      providerId,
      accountId,
    });
    return c.json({ error: 'SSO provider is misconfigured' }, 500);
  }

  const clientSecret = resolveSsoClientSecret(provider);
  if (!clientSecret) {
    logger.warn('sso_login_failure', {
      event: 'sso_login_failure',
      reason: 'missing_client_secret',
      providerId,
      accountId,
    });
    return c.json({ error: 'SSO provider is misconfigured' }, 500);
  }

  const discovery = await fetchOidcDiscovery(discoveryUrlFor(provider), {
    expectedIssuer: provider.issuer,
  });
  if (!discovery.ok) {
    logger.warn('sso_login_failure', {
      event: 'sso_login_failure',
      reason: `discovery_${discovery.reason}`,
      providerId,
      accountId,
      message: discovery.message,
    });
    return c.json({ error: 'SSO discovery failed' }, 502);
  }

  let stateResult: ReturnType<typeof generateSsoState>;
  try {
    stateResult = generateSsoState({
      accountId,
      providerId,
      redirectTo,
    });
  } catch (err) {
    logger.error('sso_login_failure', {
      event: 'sso_login_failure',
      reason: 'state_generation_failed',
      providerId,
      accountId,
      message: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: 'SSO state generation failed' }, 500);
  }

  const redirectUri = `${apiBaseUrl()}/api/auth/sso/${providerId}/callback`;
  const authUrl = buildOidcAuthorizationUrl({
    authorizationEndpoint: discovery.document.authorization_endpoint,
    clientId: provider.clientId,
    redirectUri,
    state: stateResult.state,
    codeChallenge: stateResult.codeChallenge,
    nonce: stateResult.state.slice(0, 32),
  });

  const headers = new Headers();
  headers.set('Location', authUrl);
  appendSetCookie(
    headers,
    setCookieHeader(SSO_STATE_COOKIE, stateResult.cookieValue, SSO_STATE_MAX_AGE),
  );

  return new Response(null, { status: 302, headers });
});

// ---------------------------------------------------------------------------
// GET /sso/:providerId/callback
// ---------------------------------------------------------------------------

app.get('/sso/:providerId/callback', async (c) => {
  const providerId = c.req.param('providerId');
  const code = c.req.query('code');
  const state = c.req.query('state');
  const stateCookie = readCookie(c.req.header('cookie'), SSO_STATE_COOKIE);
  const ip = clientIp(c);
  const userAgent = c.req.header('user-agent') ?? undefined;

  const fail = (reason: string, extra?: Record<string, unknown>): Response => {
    logger.warn('sso_login_failure', {
      event: 'sso_login_failure',
      reason,
      providerId,
      ...extra,
    });
    const headers = new Headers();
    appendSetCookie(headers, clearCookieHeader(SSO_STATE_COOKIE));
    const redirect = loginErrorRedirect(reason);
    for (const [k, v] of redirect.headers.entries()) {
      if (k.toLowerCase() === 'set-cookie') {
        headers.append(k, v);
      } else {
        headers.set(k, v);
      }
    }
    return new Response(null, { status: 302, headers });
  };

  const verified = verifySsoState(state, stateCookie);
  if (!verified) {
    return fail('invalid_state');
  }

  if (verified.providerId !== providerId) {
    return fail('provider_mismatch', { stateProviderId: verified.providerId });
  }

  if (!code) {
    return fail('missing_code', { accountId: verified.accountId });
  }

  const provider = await loadEnabledOidcProvider(providerId, verified.accountId);
  if (!provider) {
    return fail('provider_not_found', { accountId: verified.accountId });
  }

  const db = getClient();
  const entitled = await accountHasSsoFeature(db, verified.accountId);
  if (!entitled) {
    return fail('entitlement_denied', { accountId: verified.accountId });
  }

  if (!provider.clientId) {
    return fail('missing_client_id', { accountId: verified.accountId });
  }

  const clientSecret = resolveSsoClientSecret(provider);
  if (!clientSecret) {
    return fail('missing_client_secret', { accountId: verified.accountId });
  }

  const discovery = await fetchOidcDiscovery(discoveryUrlFor(provider), {
    expectedIssuer: provider.issuer,
  });
  if (!discovery.ok) {
    return fail(`discovery_${discovery.reason}`, {
      accountId: verified.accountId,
      message: discovery.message,
    });
  }

  const redirectUri = `${apiBaseUrl()}/api/auth/sso/${providerId}/callback`;
  const exchange = await exchangeOidcCode({
    tokenEndpoint: discovery.document.token_endpoint,
    clientId: provider.clientId,
    clientSecret,
    code,
    redirectUri,
    codeVerifier: verified.codeVerifier,
  });

  if (!exchange.ok) {
    return fail(`token_${exchange.reason}`, {
      accountId: verified.accountId,
      message: exchange.message,
    });
  }

  let jwks: ReturnType<typeof createOidcRemoteJwkSet>;
  try {
    jwks = createOidcRemoteJwkSet(discovery.document.jwks_uri);
  } catch {
    return fail('invalid_jwks_uri', { accountId: verified.accountId });
  }

  const idTokenResult = await validateOidcIdToken({
    idToken: exchange.tokens.id_token,
    issuer: provider.issuer,
    clientId: provider.clientId,
    jwks,
  });

  if (!idTokenResult.ok) {
    return fail(`id_token_${idTokenResult.reason}`, {
      accountId: verified.accountId,
      message: idTokenResult.message,
    });
  }

  const claims = idTokenResult.claims;
  const roleResult = mapSsoGroupsToRole({
    claims: claims.payload as Record<string, unknown>,
    groupClaim: provider.groupClaim,
    groupRoleMap: provider.groupRoleMap,
    defaultRole: provider.defaultRole,
    requireGroupMatch: provider.requireGroupMatch,
  });

  if (!roleResult.ok) {
    return fail(roleResult.reason, {
      accountId: verified.accountId,
      groups: roleResult.groups,
      message: roleResult.message,
    });
  }

  let user: Awaited<ReturnType<typeof upsertSsoUser>>;
  try {
    user = await upsertSsoUser({
      providerId: provider.id,
      accountId: provider.accountId,
      subject: claims.sub,
      email: claims.email,
      emailVerified: claims.emailVerified,
      name: claims.name ?? claims.preferredUsername,
      role: roleResult.role,
    });
  } catch (err) {
    logger.error('sso_login_failure', {
      event: 'sso_login_failure',
      reason: 'jit_failed',
      providerId,
      accountId: verified.accountId,
      message: err instanceof Error ? err.message : String(err),
    });
    return fail('jit_failed', { accountId: verified.accountId });
  }

  let token: string;
  try {
    const session = await createSession(user.id, {
      persistent: true,
      userAgent,
      ipAddress: ip,
      metadata: {
        authMethod: 'sso',
        ssoProviderId: provider.id,
        issuer: provider.issuer,
        accountId: provider.accountId,
      },
    });
    token = session.token;
  } catch (err) {
    logger.error('sso_login_failure', {
      event: 'sso_login_failure',
      reason: 'session_failed',
      providerId,
      accountId: verified.accountId,
      userId: user.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return fail('session_failed', { accountId: verified.accountId });
  }

  const safePath = safeSsoRedirectPath(verified.redirectTo);
  const location = new URL(safePath, publicAppBaseUrl()).toString();
  const domain = sessionCookieDomain();
  const headers = new Headers();
  headers.set('Location', location);
  // Session maxAge matches createSession persistent default (7d cookie UX;
  // DB session expiry is authoritative).
  appendSetCookie(headers, setCookieHeader(SESSION_COOKIE, token, 60 * 60 * 24 * 7, domain));
  appendSetCookie(
    headers,
    setCookieHeader(ROLE_COOKIE, user.role ?? 'viewer', 60 * 60 * 24 * 7, domain),
  );
  appendSetCookie(headers, clearCookieHeader(SSO_STATE_COOKIE));

  logger.info('sso_login_success', {
    event: 'sso_login_success',
    providerId: provider.id,
    accountId: provider.accountId,
    userId: user.id,
    issuer: provider.issuer,
    role: roleResult.role,
  });

  return new Response(null, { status: 302, headers });
});

export default app;
