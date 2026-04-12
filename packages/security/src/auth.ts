/**
 * Authentication Utilities
 *
 * OAuth support, password hashing, and two-factor authentication.
 * JWT-based auth was removed  -  session auth is handled by @revealui/auth.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface User {
  id: string;
  email: string;
  username?: string;
  roles: string[];
  permissions: string[];
  metadata?: Record<string, unknown>;
}

/**
 * OAuth configuration
 */
export interface OAuthConfig {
  provider: 'google' | 'github' | 'microsoft' | 'custom';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string[];
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
}

/**
 * OAuth provider configurations
 */
export const OAuthProviders = {
  google: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: ['openid', 'email', 'profile'],
  },
  github: {
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scope: ['user:email'],
  },
  microsoft: {
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scope: ['openid', 'email', 'profile'],
  },
};

/**
 * OAuth client
 */
export class OAuthClient {
  private config: OAuthConfig;

  constructor(config: OAuthConfig) {
    // Provider defaults fill in missing fields; user-provided config takes precedence
    this.config = {
      ...OAuthProviders[config.provider as keyof typeof OAuthProviders],
      ...config,
    };
  }

  /**
   * Get authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: (this.config.scope || []).join(' '),
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange code for token
   */
  async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  }> {
    if (!this.config.tokenUrl) throw new Error('tokenUrl is required for OAuth');
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.text();
        detail = `: ${response.status} ${body.slice(0, 200)}`;
      } catch {
        detail = `: ${response.status}`;
      }
      throw new Error(`Failed to exchange code for token${detail}`);
    }

    return response.json() as Promise<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    }>;
  }

  /**
   * Get user info
   */
  async getUserInfo(accessToken: string): Promise<{
    id: string;
    email: string;
    name?: string;
    picture?: string;
  }> {
    if (!this.config.userInfoUrl) throw new Error('userInfoUrl is required for OAuth');
    const response = await fetch(this.config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.text();
        detail = `: ${response.status} ${body.slice(0, 200)}`;
      } catch {
        detail = `: ${response.status}`;
      }
      throw new Error(`Failed to fetch user info${detail}`);
    }

    return response.json() as Promise<{
      id: string;
      email: string;
      name?: string;
      picture?: string;
    }>;
  }
}

/**
 * Password hashing utilities
 *
 * Uses PBKDF2 with a random salt for secure password hashing.
 *
 * @deprecated Use `@revealui/auth` instead  -  it uses bcrypt which is more
 * resistant to GPU brute-force attacks. This PBKDF2 implementation will be
 * removed in a future major version.
 */

const PH_ITERATIONS = 100000;
const PH_KEY_LENGTH = 64;
const PH_DIGEST = 'sha512';

/**
 * Hash password with PBKDF2 and random salt
 */
async function hashPassword(password: string): Promise<string> {
  const { pbkdf2, randomBytes: rb } = await import('node:crypto');
  const salt = rb(16).toString('hex');

  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, PH_ITERATIONS, PH_KEY_LENGTH, PH_DIGEST, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verify password against stored hash
 */
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const { pbkdf2, timingSafeEqual: tse } = await import('node:crypto');
  const [salt, hash] = storedHash.split(':');

  if (!(salt && hash)) {
    return false;
  }

  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, PH_ITERATIONS, PH_KEY_LENGTH, PH_DIGEST, (err, derivedKey) => {
      if (err) reject(err);
      else {
        const derived = Buffer.from(derivedKey.toString('hex'), 'utf-8');
        const expected = Buffer.from(hash, 'utf-8');
        if (derived.length !== expected.length) {
          resolve(false);
        } else {
          resolve(tse(derived, expected));
        }
      }
    });
  });
}

export const PasswordHasher = {
  hash: hashPassword,
  verify: verifyPassword,
} as const;

/**
 * Two-factor authentication
 */

/**
 * Base32 encode
 */
function base32Encode(buffer: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    if (byte === undefined) continue;
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }

  return result;
}

/**
 * Base32 decode (RFC 4648)  -  converts base32 string back to raw bytes.
 * Required by RFC 6238: the HMAC key must be the decoded binary secret,
 * not the base32-encoded string.
 */
function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let stripped = encoded.toUpperCase();
  let end = stripped.length;
  while (end > 0 && stripped[end - 1] === '=') end--;
  stripped = stripped.slice(0, end);
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of stripped) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Encode a 64-bit counter as an 8-byte big-endian buffer (RFC 4226 §5.2).
 * Standard authenticator apps expect this encoding  -  NOT a decimal string.
 */
function counterToBytes(counter: number): Buffer {
  const buf = Buffer.alloc(8);
  // Write as two 32-bit big-endian integers (JS numbers are safe up to 2^53)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  return buf;
}

/**
 * HMAC-SHA1 for TOTP (RFC 6238 §4).
 * Key: raw decoded bytes. Message: 8-byte big-endian counter.
 */
function totpHmac(decodedKey: Uint8Array, counterBuf: Buffer): Uint8Array {
  const hmacDigest = createHmac('sha1', decodedKey).update(counterBuf).digest();
  return new Uint8Array(hmacDigest);
}

/**
 * Generate TOTP secret
 */
function generateSecret(): string {
  const crypto = globalThis.crypto;
  if (!crypto) {
    throw new Error('Crypto API not available');
  }

  const buffer = new Uint8Array(20);
  crypto.getRandomValues(buffer);
  return base32Encode(buffer);
}

/**
 * Generate TOTP code (RFC 6238 compliant).
 * Secret is base32-encoded  -  decoded before HMAC.
 * Counter is encoded as 8-byte big-endian  -  matches all standard authenticator apps.
 */
function generateCode(secret: string, timestamp?: number): string {
  const time = Math.floor((timestamp || Date.now()) / 30000);
  const decodedKey = base32Decode(secret);
  const counterBuf = counterToBytes(time);
  const hmacDigest = totpHmac(decodedKey, counterBuf);
  // biome-ignore lint/style/noNonNullAssertion: HMAC-SHA1 always produces 20 bytes; buffer indices are guaranteed valid
  const offset = hmacDigest[hmacDigest.length - 1]! & 0x0f;
  // biome-ignore lint/style/noNonNullAssertion: HMAC-SHA1 always produces 20 bytes; buffer indices are guaranteed valid
  const b0 = hmacDigest[offset]! & 0x7f;
  // biome-ignore lint/style/noNonNullAssertion: HMAC-SHA1 always produces 20 bytes; buffer indices are guaranteed valid
  const b1 = hmacDigest[offset + 1]! & 0xff;
  // biome-ignore lint/style/noNonNullAssertion: HMAC-SHA1 always produces 20 bytes; buffer indices are guaranteed valid
  const b2 = hmacDigest[offset + 2]! & 0xff;
  // biome-ignore lint/style/noNonNullAssertion: HMAC-SHA1 always produces 20 bytes; buffer indices are guaranteed valid
  const b3 = hmacDigest[offset + 3]! & 0xff;
  const code = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) % 1000000;

  return code.toString().padStart(6, '0');
}

/**
 * Verify TOTP code
 */
function verifyCode(secret: string, code: string, window: number = 1): boolean {
  const timestamp = Date.now();

  // Check current and adjacent time windows
  for (let i = -window; i <= window; i++) {
    const testTime = timestamp + i * 30000;
    const testCode = generateCode(secret, testTime);

    if (
      testCode.length === code.length &&
      timingSafeEqual(Buffer.from(testCode), Buffer.from(code))
    ) {
      return true;
    }
  }

  return false;
}

export const TwoFactorAuth = {
  generateSecret,
  generateCode,
  verifyCode,
} as const;
