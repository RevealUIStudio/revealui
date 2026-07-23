/**
 * Authentication Utilities Tests
 *
 * Covers: TwoFactorAuth (TOTP).
 * OAuthClient / OAuthProviders removed in fleet-redundancy P2-B (zero production
 * importers; use @revealui/auth for OAuth/social sign-in).
 */

import { describe, expect, it } from 'vitest';
import { TwoFactorAuth } from '../auth.js';

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
