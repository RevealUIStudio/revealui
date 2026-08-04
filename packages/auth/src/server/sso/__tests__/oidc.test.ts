import { generateKeyPairSync } from 'node:crypto';
import { exportJWK, importPKCS8, SignJWT } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildOidcAuthorizationUrl, fetchOidcDiscovery, validateOidcIdToken } from '../oidc.js';

const ISSUER = 'https://idp.example.com';
const CLIENT_ID = 'revealui-sso-client';
const OTHER_ISSUER = 'https://evil.example.com';
const OTHER_AUD = 'other-client';

let privateKeyPem: string;
let publicKey: CryptoKey;
let privateKey: CryptoKey;

beforeAll(async () => {
  const { publicKey: pubPem, privateKey: privPem } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKeyPem = privPem;
  privateKey = await importPKCS8(privateKeyPem, 'RS256');
  // Import public key via JWK for jwtVerify KeyLike
  const { createPublicKey } = await import('node:crypto');
  const pub = createPublicKey(pubPem);
  const jwk = await exportJWK(pub);
  const { importJWK } = await import('jose');
  publicKey = (await importJWK({ ...jwk, alg: 'RS256' }, 'RS256')) as CryptoKey;
});

async function signIdToken(
  claims: Record<string, unknown>,
  options?: { issuer?: string; audience?: string; expSeconds?: number; key?: CryptoKey },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = options?.expSeconds ?? now + 3600;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(options?.issuer ?? ISSUER)
    .setAudience(options?.audience ?? CLIENT_ID)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setSubject(typeof claims.sub === 'string' ? claims.sub : 'user-sub-1')
    .sign(options?.key ?? privateKey);
}

describe('fetchOidcDiscovery', () => {
  it('parses a valid discovery document', async () => {
    const doc = {
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      jwks_uri: `${ISSUER}/jwks`,
      scopes_supported: ['openid', 'email'],
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => doc,
    });

    const result = await fetchOidcDiscovery(`${ISSUER}/.well-known/openid-configuration`, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      expectedIssuer: ISSUER,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.issuer).toBe(ISSUER);
      expect(result.document.authorization_endpoint).toBe(`${ISSUER}/authorize`);
      expect(result.document.token_endpoint).toBe(`${ISSUER}/token`);
      expect(result.document.jwks_uri).toBe(`${ISSUER}/jwks`);
    }
  });

  it('normalizes trailing slashes when matching expectedIssuer', async () => {
    const doc = {
      issuer: `${ISSUER}/`,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      jwks_uri: `${ISSUER}/jwks`,
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => doc,
    });

    const result = await fetchOidcDiscovery(`${ISSUER}/.well-known/openid-configuration`, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      expectedIssuer: `${ISSUER}///`,
    });

    expect(result.ok).toBe(true);
  });

  it('rejects missing required fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ issuer: ISSUER }),
    });
    const result = await fetchOidcDiscovery(
      'https://idp.example.com/.well-known/openid-configuration',
      {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing_required_fields');
    }
  });

  it('rejects issuer mismatch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        issuer: OTHER_ISSUER,
        authorization_endpoint: `${OTHER_ISSUER}/a`,
        token_endpoint: `${OTHER_ISSUER}/t`,
        jwks_uri: `${OTHER_ISSUER}/j`,
      }),
    });
    const result = await fetchOidcDiscovery(
      'https://idp.example.com/.well-known/openid-configuration',
      {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        expectedIssuer: ISSUER,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('issuer_mismatch');
    }
  });

  it('rejects fetch failures', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await fetchOidcDiscovery(
      'https://idp.example.com/.well-known/openid-configuration',
      {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('fetch_failed');
    }
  });
});

describe('buildOidcAuthorizationUrl', () => {
  it('includes PKCE S256 and required OIDC params', () => {
    const url = buildOidcAuthorizationUrl({
      authorizationEndpoint: `${ISSUER}/authorize`,
      clientId: CLIENT_ID,
      redirectUri: 'https://app.example.com/api/auth/sso/prov/callback',
      state: 'state-value',
      codeChallenge: 'challenge-value',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(parsed.searchParams.get('state')).toBe('state-value');
    expect(parsed.searchParams.get('scope')).toContain('openid');
  });
});

describe('validateOidcIdToken', () => {
  it('accepts a happy-path signed id_token', async () => {
    const token = await signIdToken({
      sub: 'user-42',
      email: 'user@example.com',
      email_verified: true,
      name: 'Test User',
      groups: ['Engineering'],
    });

    const result = await validateOidcIdToken({
      idToken: token,
      issuer: ISSUER,
      clientId: CLIENT_ID,
      jwks: publicKey,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.sub).toBe('user-42');
      expect(result.claims.email).toBe('user@example.com');
      expect(result.claims.emailVerified).toBe(true);
      expect(result.claims.name).toBe('Test User');
      expect(result.claims.payload.groups).toEqual(['Engineering']);
    }
  });

  it('rejects missing token', async () => {
    const result = await validateOidcIdToken({
      idToken: '',
      issuer: ISSUER,
      clientId: CLIENT_ID,
      jwks: publicKey,
    });
    expect(result).toMatchObject({ ok: false, reason: 'missing_token' });
  });

  it('rejects when jwks key is missing', async () => {
    const result = await validateOidcIdToken({
      idToken: 'a.b.c',
      issuer: ISSUER,
      clientId: CLIENT_ID,
      jwks: null as unknown as CryptoKey,
    });
    expect(result).toMatchObject({ ok: false, reason: 'missing_key' });
  });

  it('rejects tampered signature', async () => {
    const token = await signIdToken({ sub: 'user-1' });
    const parts = token.split('.');
    // Flip last char of signature
    const sig = parts[2] as string;
    const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A');
    const tampered = `${parts[0]}.${parts[1]}.${flipped}`;

    const result = await validateOidcIdToken({
      idToken: tampered,
      issuer: ISSUER,
      clientId: CLIENT_ID,
      jwks: publicKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_signature');
    }
  });

  it('rejects wrong issuer', async () => {
    const token = await signIdToken({ sub: 'user-1' }, { issuer: OTHER_ISSUER });
    const result = await validateOidcIdToken({
      idToken: token,
      issuer: ISSUER,
      clientId: CLIENT_ID,
      jwks: publicKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_issuer');
    }
  });

  it('rejects wrong audience', async () => {
    const token = await signIdToken({ sub: 'user-1' }, { audience: OTHER_AUD });
    const result = await validateOidcIdToken({
      idToken: token,
      issuer: ISSUER,
      clientId: CLIENT_ID,
      jwks: publicKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_audience');
    }
  });

  it('rejects expired token', async () => {
    const token = await signIdToken(
      { sub: 'user-1' },
      { expSeconds: Math.floor(Date.now() / 1000) - 120 },
    );
    const result = await validateOidcIdToken({
      idToken: token,
      issuer: ISSUER,
      clientId: CLIENT_ID,
      jwks: publicKey,
      clockToleranceSeconds: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('expired');
    }
  });

  it('rejects token signed with a different key', async () => {
    const other = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const otherPriv = await importPKCS8(other.privateKey, 'RS256');
    const token = await signIdToken({ sub: 'user-1' }, { key: otherPriv });

    const result = await validateOidcIdToken({
      idToken: token,
      issuer: ISSUER,
      clientId: CLIENT_ID,
      jwks: publicKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_signature');
    }
  });

  it('rejects malformed compact JWT', async () => {
    const result = await validateOidcIdToken({
      idToken: 'not-a-jwt',
      issuer: ISSUER,
      clientId: CLIENT_ID,
      jwks: publicKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['malformed', 'invalid_signature']).toContain(result.reason);
    }
  });

  it('rejects token missing sub', async () => {
    const now = Math.floor(Date.now() / 1000);
    // SignJWT always sets sub via setSubject; build a JWT without sub manually
    const token = await new SignJWT({ email: 'x@example.com' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);

    const result = await validateOidcIdToken({
      idToken: token,
      issuer: ISSUER,
      clientId: CLIENT_ID,
      jwks: publicKey,
    });
    expect(result).toMatchObject({ ok: false, reason: 'missing_sub' });
  });
});
