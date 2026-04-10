/**
 * Authentication Utilities Tests
 *
 * Covers: OAuthClient, PasswordHasher, TwoFactorAuth (TOTP).
 */

import { describe, expect, it, vi } from 'vitest';
import { OAuthClient, PasswordHasher, TwoFactorAuth } from '../auth.js';

// =============================================================================
// OAuthClient
// =============================================================================

describe('OAuthClient', () => {
  const baseConfig = {
    provider: 'github' as const,
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://app.revealui.com/callback',
  };

  it('generates authorization URL with provider defaults', () => {
    const client = new OAuthClient(baseConfig);
    const url = client.getAuthorizationUrl();

    expect(url).toContain('https://github.com/login/oauth/authorize');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('response_type=code');
    expect(url).toContain('redirect_uri=');
  });

  it('includes state parameter when provided', () => {
    const client = new OAuthClient(baseConfig);
    const url = client.getAuthorizationUrl('random-state-123');
    expect(url).toContain('state=random-state-123');
  });

  it('omits state parameter when not provided', () => {
    const client = new OAuthClient(baseConfig);
    const url = client.getAuthorizationUrl();
    expect(url).not.toContain('state=');
  });

  it('uses Google provider defaults', () => {
    const client = new OAuthClient({ ...baseConfig, provider: 'google' });
    const url = client.getAuthorizationUrl();
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('scope=openid+email+profile');
  });

  it('uses custom provider URLs', () => {
    const client = new OAuthClient({
      ...baseConfig,
      provider: 'custom',
      authorizationUrl: 'https://custom.auth/authorize',
      tokenUrl: 'https://custom.auth/token',
      userInfoUrl: 'https://custom.auth/userinfo',
      scope: ['read', 'write'],
    });
    const url = client.getAuthorizationUrl();
    expect(url).toContain('https://custom.auth/authorize');
    expect(url).toContain('scope=read+write');
  });

  it('exchangeCodeForToken throws on non-ok response', async () => {
    const client = new OAuthClient(baseConfig);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Bad Request', { status: 400 }),
    );

    await expect(client.exchangeCodeForToken('bad-code')).rejects.toThrow(
      'Failed to exchange code for token',
    );

    vi.restoreAllMocks();
  });

  it('exchangeCodeForToken returns token on success', async () => {
    const client = new OAuthClient(baseConfig);
    const tokenResponse = {
      access_token: 'gho_test123',
      token_type: 'bearer',
      expires_in: 3600,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(tokenResponse), { status: 200 }),
    );

    const result = await client.exchangeCodeForToken('valid-code');
    expect(result.access_token).toBe('gho_test123');

    vi.restoreAllMocks();
  });

  it('getUserInfo throws on non-ok response', async () => {
    const client = new OAuthClient(baseConfig);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(client.getUserInfo('bad-token')).rejects.toThrow('Failed to fetch user info');

    vi.restoreAllMocks();
  });

  it('getUserInfo returns user data on success', async () => {
    const client = new OAuthClient(baseConfig);
    const userData = { id: '123', email: 'user@example.com', name: 'Test User' };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(userData), { status: 200 }),
    );

    const result = await client.getUserInfo('valid-token');
    expect(result.email).toBe('user@example.com');

    vi.restoreAllMocks();
  });
});

// =============================================================================
// PasswordHasher (PBKDF2)
// =============================================================================

describe('PasswordHasher', () => {
  it('hashes a password and produces salt:hash format', async () => {
    const hashed = await PasswordHasher.hash('mypassword');
    expect(hashed).toContain(':');

    const [salt, hash] = hashed.split(':');
    expect(salt).toBeDefined();
    expect(hash).toBeDefined();
    expect(salt!.length).toBe(32); // 16 bytes hex
    expect(hash!.length).toBe(128); // 64 bytes hex
  });

  it('verifies correct password', async () => {
    const hashed = await PasswordHasher.hash('correct-password');
    const valid = await PasswordHasher.verify('correct-password', hashed);
    expect(valid).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hashed = await PasswordHasher.hash('correct-password');
    const valid = await PasswordHasher.verify('wrong-password', hashed);
    expect(valid).toBe(false);
  });

  it('produces different hashes for same password (random salt)', async () => {
    const hash1 = await PasswordHasher.hash('same-password');
    const hash2 = await PasswordHasher.hash('same-password');
    expect(hash1).not.toBe(hash2);
  });

  it('rejects malformed hash (no colon)', async () => {
    const valid = await PasswordHasher.verify('password', 'nocolonhere');
    expect(valid).toBe(false);
  });
});

// =============================================================================
// TwoFactorAuth (TOTP)
// =============================================================================

describe('TwoFactorAuth', () => {
  it('generateSecret produces a base32 string', () => {
    const secret = TwoFactorAuth.generateSecret();
    expect(secret.length).toBeGreaterThan(0);
    // Base32 characters only
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('generateSecret produces unique values', () => {
    const s1 = TwoFactorAuth.generateSecret();
    const s2 = TwoFactorAuth.generateSecret();
    expect(s1).not.toBe(s2);
  });

  it('generateCode produces a 6-digit string', () => {
    const secret = TwoFactorAuth.generateSecret();
    const code = TwoFactorAuth.generateCode(secret);
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('generateCode is deterministic for same secret and timestamp', () => {
    const secret = TwoFactorAuth.generateSecret();
    const timestamp = 1700000000000;
    const code1 = TwoFactorAuth.generateCode(secret, timestamp);
    const code2 = TwoFactorAuth.generateCode(secret, timestamp);
    expect(code1).toBe(code2);
  });

  it('generateCode produces different codes for different time windows', () => {
    const secret = TwoFactorAuth.generateSecret();
    const code1 = TwoFactorAuth.generateCode(secret, 1700000000000);
    const code2 = TwoFactorAuth.generateCode(secret, 1700000060000); // 60s later = different window
    expect(code1).not.toBe(code2);
  });

  it('verifyCode accepts the current code', () => {
    const secret = TwoFactorAuth.generateSecret();
    const code = TwoFactorAuth.generateCode(secret);
    const valid = TwoFactorAuth.verifyCode(secret, code);
    expect(valid).toBe(true);
  });

  it('verifyCode rejects a wrong code', () => {
    const secret = TwoFactorAuth.generateSecret();
    const realCode = TwoFactorAuth.generateCode(secret);
    const wrongCode = realCode === '000000' ? '999999' : '000000';
    expect(TwoFactorAuth.verifyCode(secret, wrongCode)).toBe(false);
  });

  it('verifyCode accepts codes within time window', () => {
    const secret = TwoFactorAuth.generateSecret();
    // Generate code for 30s ago (within default window of 1)
    const pastCode = TwoFactorAuth.generateCode(secret, Date.now() - 30000);
    const valid = TwoFactorAuth.verifyCode(secret, pastCode, 1);
    expect(valid).toBe(true);
  });

  it('verifyCode rejects codes with wrong length', () => {
    const secret = TwoFactorAuth.generateSecret();
    expect(TwoFactorAuth.verifyCode(secret, '12345')).toBe(false); // 5 digits
    expect(TwoFactorAuth.verifyCode(secret, '1234567')).toBe(false); // 7 digits
  });
});
