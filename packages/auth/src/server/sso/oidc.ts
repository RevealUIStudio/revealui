/**
 * OIDC discovery + id_token validation (GAP-464 Phase 2).
 *
 * Security hardlines:
 * - Never accept id_token without cryptographic signature validation (JWKS / key).
 * - Validate issuer, audience (client_id), and exp on every token.
 */

import {
  createRemoteJWKSet,
  type JWTPayload,
  type JWTVerifyGetKey,
  type JWTVerifyOptions,
  type JWTVerifyResult,
  jwtVerify,
  type KeyLike,
} from 'jose';

/** Asymmetric algorithms used by enterprise IdPs; `none` is never allowed. */
const ID_TOKEN_ALGORITHMS: string[] = [
  'RS256',
  'RS384',
  'RS512',
  'ES256',
  'ES384',
  'ES512',
  'PS256',
  'PS384',
  'PS512',
  'EdDSA',
];

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  code_challenge_methods_supported?: string[];
}

export type OidcDiscoveryFailureReason =
  | 'fetch_failed'
  | 'invalid_json'
  | 'missing_required_fields'
  | 'issuer_mismatch';

export type FetchOidcDiscoveryResult =
  | { ok: true; document: OidcDiscoveryDocument }
  | { ok: false; reason: OidcDiscoveryFailureReason; message: string };

export interface FetchOidcDiscoveryOptions {
  /**
   * Optional expected issuer. When set, the document's `issuer` must match
   * (after trailing-slash normalization).
   */
  expectedIssuer?: string;
  /** Injectable fetch for tests (defaults to global fetch) */
  fetchImpl?: typeof fetch;
  /** Request timeout ms (default 10_000) */
  timeoutMs?: number;
}

const DISCOVERY_REQUIRED = [
  'issuer',
  'authorization_endpoint',
  'token_endpoint',
  'jwks_uri',
] as const;

/** Strip trailing `/` without regex (CodeQL: avoid poly ReDoS on uncontrolled issuer). */
function normalizeIssuer(issuer: string): string {
  let end = issuer.length;
  while (end > 0 && issuer.charCodeAt(end - 1) === 47 /* '/' */) {
    end -= 1;
  }
  return end === issuer.length ? issuer : issuer.slice(0, end);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Fetch and parse an OIDC discovery document (openid-configuration).
 */
export async function fetchOidcDiscovery(
  discoveryUrl: string,
  options: FetchOidcDiscoveryOptions = {},
): Promise<FetchOidcDiscoveryResult> {
  if (!isNonEmptyString(discoveryUrl)) {
    return {
      ok: false,
      reason: 'missing_required_fields',
      message: 'discoveryUrl is required',
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(discoveryUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : 'discovery fetch failed';
    return { ok: false, reason: 'fetch_failed', message };
  }
  clearTimeout(timer);

  if (!response.ok) {
    return {
      ok: false,
      reason: 'fetch_failed',
      message: `discovery HTTP ${response.status}`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: 'invalid_json', message: 'discovery response is not JSON' };
  }

  if (!body || typeof body !== 'object') {
    return { ok: false, reason: 'invalid_json', message: 'discovery response is not an object' };
  }

  const record = body as Record<string, unknown>;
  for (const key of DISCOVERY_REQUIRED) {
    if (!isNonEmptyString(record[key])) {
      return {
        ok: false,
        reason: 'missing_required_fields',
        message: `discovery document missing ${key}`,
      };
    }
  }

  const document: OidcDiscoveryDocument = {
    issuer: record.issuer as string,
    authorization_endpoint: record.authorization_endpoint as string,
    token_endpoint: record.token_endpoint as string,
    jwks_uri: record.jwks_uri as string,
  };

  if (isNonEmptyString(record.userinfo_endpoint)) {
    document.userinfo_endpoint = record.userinfo_endpoint;
  }
  if (isNonEmptyString(record.end_session_endpoint)) {
    document.end_session_endpoint = record.end_session_endpoint;
  }
  if (Array.isArray(record.scopes_supported)) {
    document.scopes_supported = record.scopes_supported.filter(
      (s): s is string => typeof s === 'string',
    );
  }
  if (Array.isArray(record.response_types_supported)) {
    document.response_types_supported = record.response_types_supported.filter(
      (s): s is string => typeof s === 'string',
    );
  }
  if (Array.isArray(record.code_challenge_methods_supported)) {
    document.code_challenge_methods_supported = record.code_challenge_methods_supported.filter(
      (s): s is string => typeof s === 'string',
    );
  }

  if (options.expectedIssuer) {
    if (normalizeIssuer(document.issuer) !== normalizeIssuer(options.expectedIssuer)) {
      return {
        ok: false,
        reason: 'issuer_mismatch',
        message: `discovery issuer "${document.issuer}" does not match expected "${options.expectedIssuer}"`,
      };
    }
  }

  return { ok: true, document };
}

// ---------------------------------------------------------------------------
// Authorization URL (pure)
// ---------------------------------------------------------------------------

export interface BuildOidcAuthorizationUrlInput {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  /** Default: openid email profile */
  scope?: string;
  /** Optional OIDC nonce (distinct from SSO state nonce) */
  nonce?: string;
}

/**
 * Build the OIDC authorization redirect URL (code + PKCE S256).
 */
export function buildOidcAuthorizationUrl(input: BuildOidcAuthorizationUrlInput): string {
  const url = new URL(input.authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('scope', input.scope ?? 'openid email profile');
  url.searchParams.set('state', input.state);
  url.searchParams.set('code_challenge', input.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (input.nonce) {
    url.searchParams.set('nonce', input.nonce);
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// id_token validation
// ---------------------------------------------------------------------------

export type ValidateIdTokenFailureReason =
  | 'missing_token'
  | 'missing_key'
  | 'invalid_signature'
  | 'invalid_issuer'
  | 'invalid_audience'
  | 'expired'
  | 'not_yet_valid'
  | 'missing_sub'
  | 'malformed';

export interface ValidatedIdTokenClaims {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  preferredUsername?: string;
  /** Full verified JWT payload (includes groups, custom claims, etc.) */
  payload: JWTPayload;
}

export type ValidateIdTokenResult =
  | { ok: true; claims: ValidatedIdTokenClaims }
  | { ok: false; reason: ValidateIdTokenFailureReason; message: string };

export interface ValidateOidcIdTokenOptions {
  idToken: string;
  /** Expected `iss` (must match provider.issuer) */
  issuer: string;
  /** Expected `aud` (OIDC client_id) */
  clientId: string;
  /**
   * Key material for signature verification.
   * Pass a remote JWKS getter (`createRemoteJWKSet(new URL(jwks_uri))`),
   * a local JWK set, or a single KeyLike from tests.
   * REQUIRED — unsigned tokens are never accepted.
   */
  jwks: JWTVerifyGetKey | KeyLike | Uint8Array;
  /** Clock skew tolerance in seconds (default 30) */
  clockToleranceSeconds?: number;
}

function mapJoseError(err: unknown): { reason: ValidateIdTokenFailureReason; message: string } {
  const message = err instanceof Error ? err.message : 'id_token validation failed';
  const code =
    err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
      ? (err as { code: string }).code
      : '';
  const claim =
    err &&
    typeof err === 'object' &&
    'claim' in err &&
    typeof (err as { claim: unknown }).claim === 'string'
      ? (err as { claim: string }).claim
      : '';

  // Prefer jose error codes / claim names over message regex (avoids "exp" matching "expected")
  if (code === 'ERR_JWT_EXPIRED' || claim === 'exp') {
    return { reason: 'expired', message };
  }
  if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' || claim) {
    if (claim === 'iss' || /"iss"/i.test(message)) {
      return { reason: 'invalid_issuer', message };
    }
    if (claim === 'aud' || /"aud"/i.test(message)) {
      return { reason: 'invalid_audience', message };
    }
    if (claim === 'nbf' || /"nbf"/i.test(message)) {
      return { reason: 'not_yet_valid', message };
    }
  }
  if (
    code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' ||
    code === 'ERR_JWS_INVALID' ||
    /signature verification failed|jws signature/i.test(message)
  ) {
    return { reason: 'invalid_signature', message };
  }
  if (code === 'ERR_JWT_INVALID' || /compact jws|invalid token/i.test(message)) {
    return { reason: 'malformed', message };
  }

  return { reason: 'invalid_signature', message };
}

/**
 * Validate an OIDC id_token: signature (JWKS), issuer, audience, exp.
 *
 * Hardline: `jwks` is required. Callers must not pass a no-op key or skip verify.
 */
export async function validateOidcIdToken(
  options: ValidateOidcIdTokenOptions,
): Promise<ValidateIdTokenResult> {
  const { idToken, issuer, clientId, jwks, clockToleranceSeconds = 30 } = options;

  if (!isNonEmptyString(idToken)) {
    return { ok: false, reason: 'missing_token', message: 'id_token is required' };
  }
  if (jwks == null) {
    return {
      ok: false,
      reason: 'missing_key',
      message: 'JWKS / verification key is required; unsigned id_tokens are rejected',
    };
  }
  if (!isNonEmptyString(issuer)) {
    return { ok: false, reason: 'invalid_issuer', message: 'expected issuer is required' };
  }
  if (!isNonEmptyString(clientId)) {
    return { ok: false, reason: 'invalid_audience', message: 'clientId (audience) is required' };
  }

  // Prefer asymmetric algorithms used by enterprise IdPs; reject `none`
  const verifyOptions: JWTVerifyOptions = {
    issuer: normalizeIssuer(issuer),
    audience: clientId,
    clockTolerance: clockToleranceSeconds,
    algorithms: ID_TOKEN_ALGORITHMS,
  };

  let payload: JWTPayload;
  try {
    // jose types KeyLike and JWTVerifyGetKey as separate overloads — narrow first
    let verified: JWTVerifyResult;
    if (typeof jwks === 'function') {
      verified = await jwtVerify(idToken, jwks, verifyOptions);
    } else {
      verified = await jwtVerify(idToken, jwks, verifyOptions);
    }
    payload = verified.payload;
  } catch (err) {
    return { ok: false, ...mapJoseError(err) };
  }

  if (!isNonEmptyString(payload.sub)) {
    return { ok: false, reason: 'missing_sub', message: 'id_token missing sub claim' };
  }

  const claims: ValidatedIdTokenClaims = {
    sub: payload.sub,
    payload,
  };

  if (typeof payload.email === 'string' && payload.email.length > 0) {
    claims.email = payload.email;
  }
  if (typeof payload.email_verified === 'boolean') {
    claims.emailVerified = payload.email_verified;
  } else if (payload.email_verified === 'true') {
    claims.emailVerified = true;
  } else if (payload.email_verified === 'false') {
    claims.emailVerified = false;
  }
  if (typeof payload.name === 'string' && payload.name.length > 0) {
    claims.name = payload.name;
  }
  if (typeof payload.preferred_username === 'string' && payload.preferred_username.length > 0) {
    claims.preferredUsername = payload.preferred_username;
  }

  return { ok: true, claims };
}

/**
 * Create a remote JWKS key resolver from a discovery `jwks_uri`.
 * Thin wrapper so route code does not import jose directly.
 */
export function createOidcRemoteJwkSet(jwksUri: string): JWTVerifyGetKey {
  if (!isNonEmptyString(jwksUri)) {
    throw new Error('jwksUri is required');
  }
  return createRemoteJWKSet(new URL(jwksUri));
}

// ---------------------------------------------------------------------------
// Authorization code exchange
// ---------------------------------------------------------------------------

export type ExchangeOidcCodeFailureReason =
  | 'missing_params'
  | 'fetch_failed'
  | 'invalid_json'
  | 'missing_id_token';

export interface ExchangeOidcCodeInput {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  /** Injectable fetch for tests (defaults to global fetch) */
  fetchImpl?: typeof fetch;
  /** Request timeout ms (default 10_000) */
  timeoutMs?: number;
}

export interface ExchangeOidcCodeSuccess {
  id_token: string;
  access_token?: string;
}

export type ExchangeOidcCodeResult =
  | { ok: true; tokens: ExchangeOidcCodeSuccess }
  | { ok: false; reason: ExchangeOidcCodeFailureReason; message: string };

/**
 * Exchange an OIDC authorization code for tokens (PKCE + client_secret).
 *
 * POSTs `application/x-www-form-urlencoded`. Rejects responses without `id_token`.
 * Never logs client_secret or tokens.
 */
export async function exchangeOidcCode(
  input: ExchangeOidcCodeInput,
): Promise<ExchangeOidcCodeResult> {
  const {
    tokenEndpoint,
    clientId,
    clientSecret,
    code,
    redirectUri,
    codeVerifier,
    fetchImpl = fetch,
    timeoutMs = 10_000,
  } = input;

  if (
    !(
      isNonEmptyString(tokenEndpoint) &&
      isNonEmptyString(clientId) &&
      isNonEmptyString(clientSecret) &&
      isNonEmptyString(code) &&
      isNonEmptyString(redirectUri) &&
      isNonEmptyString(codeVerifier)
    )
  ) {
    return {
      ok: false,
      reason: 'missing_params',
      message:
        'tokenEndpoint, clientId, clientSecret, code, redirectUri, and codeVerifier are required',
    };
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      signal: controller.signal,
      redirect: 'error',
    });
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : 'token exchange fetch failed';
    return { ok: false, reason: 'fetch_failed', message };
  }
  clearTimeout(timer);

  if (!response.ok) {
    return {
      ok: false,
      reason: 'fetch_failed',
      message: `token endpoint HTTP ${response.status}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return { ok: false, reason: 'invalid_json', message: 'token response is not JSON' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'invalid_json', message: 'token response is not an object' };
  }

  const record = parsed as Record<string, unknown>;
  if (!isNonEmptyString(record.id_token)) {
    return {
      ok: false,
      reason: 'missing_id_token',
      message: 'token response missing id_token',
    };
  }

  const tokens: ExchangeOidcCodeSuccess = { id_token: record.id_token };
  if (isNonEmptyString(record.access_token)) {
    tokens.access_token = record.access_token;
  }

  return { ok: true, tokens };
}

export type { JWTPayload, JWTVerifyGetKey, KeyLike };
