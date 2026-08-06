/**
 * Minimal mock OIDC IdP for GAP-464 integration tests.
 * Real RSA keys + jose-signed id_tokens; discovery/token/jwks via fetchImpl.
 */

import { generateKeyPairSync } from 'node:crypto';
import { exportJWK, importPKCS8, type JWTPayload, type KeyLike, SignJWT } from 'jose';

export interface MockOidcIdpOptions {
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface MockOidcIdp {
  issuer: string;
  clientId: string;
  clientSecret: string;
  discoveryUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  /** Local KeyLike for direct validateOidcIdToken tests */
  publicKey: KeyLike;
  signIdToken: (
    claims?: Record<string, unknown>,
    overrides?: {
      issuer?: string;
      audience?: string;
      expSeconds?: number;
      privateKey?: KeyLike;
    },
  ) => Promise<string>;
  /** fetchImpl that routes discovery, jwks, and token endpoints */
  fetchImpl: typeof fetch;
}

export async function createMockOidcIdp(options: MockOidcIdpOptions = {}): Promise<MockOidcIdp> {
  const issuer = options.issuer ?? 'https://mock-idp.example.com';
  const clientId = options.clientId ?? 'revealui-sso-client';
  const clientSecret = options.clientSecret ?? 'mock-client-secret';

  const { publicKey: pubPem, privateKey: privPem } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const privateKey = await importPKCS8(privPem, 'RS256');
  const { createPublicKey } = await import('node:crypto');
  const pub = createPublicKey(pubPem);
  const jwk = await exportJWK(pub);
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  jwk.kid = 'mock-idp-1';

  const publicKey = (await (
    await import('jose')
  ).importJWK({ ...jwk, alg: 'RS256' }, 'RS256')) as KeyLike;

  const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
  const authorizationEndpoint = `${issuer}/authorize`;
  const tokenEndpoint = `${issuer}/token`;
  const jwksUri = `${issuer}/jwks`;

  async function signIdToken(
    claims: Record<string, unknown> = {},
    overrides?: {
      issuer?: string;
      audience?: string;
      expSeconds?: number;
      privateKey?: KeyLike;
    },
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const exp = overrides?.expSeconds ?? now + 3600;
    const sub = typeof claims.sub === 'string' ? claims.sub : 'user-sub-1';
    const payload: JWTPayload = { ...claims, sub };
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: 'mock-idp-1' })
      .setIssuer(overrides?.issuer ?? issuer)
      .setAudience(overrides?.audience ?? clientId)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .setSubject(sub)
      .sign(overrides?.privateKey ?? privateKey);
  }

  const discoveryDoc = {
    issuer,
    authorization_endpoint: authorizationEndpoint,
    token_endpoint: tokenEndpoint,
    jwks_uri: jwksUri,
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['openid', 'email', 'profile'],
  };

  const jwksDoc = { keys: [jwk] };

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url === discoveryUrl || url.startsWith(`${discoveryUrl}?`)) {
      return new Response(JSON.stringify(discoveryDoc), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === jwksUri || url.startsWith(`${jwksUri}?`)) {
      return new Response(JSON.stringify(jwksDoc), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === tokenEndpoint || url.startsWith(`${tokenEndpoint}?`)) {
      if ((init?.method ?? 'GET').toUpperCase() !== 'POST') {
        return new Response('method not allowed', { status: 405 });
      }
      // undici may pass URLSearchParams; avoid cross-realm instanceof
      const rawBody = init?.body;
      const bodyText =
        rawBody == null
          ? ''
          : typeof rawBody === 'string'
            ? rawBody
            : typeof (rawBody as { toString?: () => string }).toString === 'function'
              ? (rawBody as { toString: () => string }).toString()
              : '';
      const params = new URLSearchParams(bodyText);
      // Accept any non-empty code; mock IdP does not track issued codes
      if (!params.get('code') || params.get('grant_type') !== 'authorization_code') {
        return new Response(JSON.stringify({ error: 'invalid_request', body: bodyText }), {
          status: 400,
        });
      }
      if (params.get('client_id') !== clientId || params.get('client_secret') !== clientSecret) {
        return new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 });
      }
      const idToken = await signIdToken({
        email: 'alice@example.com',
        email_verified: true,
        name: 'Alice Example',
        groups: ['Engineering', 'Staff'],
      });
      return new Response(
        JSON.stringify({
          id_token: idToken,
          access_token: 'mock-access',
          token_type: 'Bearer',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(`not found: ${url}`, { status: 404 });
  }) as typeof fetch;

  return {
    issuer,
    clientId,
    clientSecret,
    discoveryUrl,
    authorizationEndpoint,
    tokenEndpoint,
    jwksUri,
    publicKey,
    signIdToken,
    fetchImpl,
  };
}
