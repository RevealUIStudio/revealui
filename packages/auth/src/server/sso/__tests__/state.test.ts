import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateSsoState, verifySsoState } from '../state.js';

const SECRET = 'test-secret-key-for-sso-hmac-signing-only';

describe('sso state', () => {
  const prevSecret = process.env.REVEALUI_SECRET;

  beforeEach(() => {
    process.env.REVEALUI_SECRET = SECRET;
  });

  afterEach(() => {
    if (prevSecret === undefined) {
      delete process.env.REVEALUI_SECRET;
    } else {
      process.env.REVEALUI_SECRET = prevSecret;
    }
  });

  describe('generateSsoState', () => {
    it('returns state, cookieValue, and codeChallenge', () => {
      const result = generateSsoState({
        accountId: 'acc_1',
        providerId: 'prov_1',
        redirectTo: '/app',
      });
      expect(result.state).toBeTruthy();
      expect(result.cookieValue).toContain('.');
      expect(result.cookieValue.startsWith(result.state)).toBe(true);
      expect(result.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('encodes accountId, providerId, redirectTo, nonce, codeVerifier', () => {
      const { state } = generateSsoState({
        accountId: 'acc_abc',
        providerId: 'prov_xyz',
        redirectTo: '/settings',
      });
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString()) as Record<
        string,
        unknown
      >;
      expect(decoded.accountId).toBe('acc_abc');
      expect(decoded.providerId).toBe('prov_xyz');
      expect(decoded.redirectTo).toBe('/settings');
      expect(typeof decoded.nonce).toBe('string');
      expect(typeof decoded.codeVerifier).toBe('string');
    });

    it('throws when REVEALUI_SECRET is missing', () => {
      delete process.env.REVEALUI_SECRET;
      expect(() => generateSsoState({ accountId: 'a', providerId: 'p', redirectTo: '/' })).toThrow(
        'REVEALUI_SECRET',
      );
    });

    it('throws when accountId or providerId is empty', () => {
      expect(() => generateSsoState({ accountId: '', providerId: 'p', redirectTo: '/' })).toThrow(
        'accountId and providerId',
      );
    });

    it('generates unique nonces', () => {
      const a = generateSsoState({ accountId: 'a', providerId: 'p', redirectTo: '/' });
      const b = generateSsoState({ accountId: 'a', providerId: 'p', redirectTo: '/' });
      expect(a.state).not.toBe(b.state);
    });
  });

  describe('verifySsoState', () => {
    it('round-trips generate → verify', () => {
      const { state, cookieValue } = generateSsoState({
        accountId: 'acc_1',
        providerId: 'prov_1',
        redirectTo: '/dashboard',
      });
      const verified = verifySsoState(state, cookieValue);
      expect(verified).toMatchObject({
        accountId: 'acc_1',
        providerId: 'prov_1',
        redirectTo: '/dashboard',
      });
      expect(verified?.nonce).toBeTruthy();
      expect(verified?.codeVerifier).toBeTruthy();
    });

    it('returns null when state is null', () => {
      expect(verifySsoState(null, 'x.y')).toBeNull();
    });

    it('returns null when cookie is null', () => {
      expect(verifySsoState('state', null)).toBeNull();
    });

    it('returns null when cookie has no HMAC separator', () => {
      expect(verifySsoState('abc', 'nodot')).toBeNull();
    });

    it('returns null when state does not match cookie state', () => {
      const { cookieValue } = generateSsoState({
        accountId: 'a',
        providerId: 'p',
        redirectTo: '/',
      });
      expect(verifySsoState('tampered-state-value', cookieValue)).toBeNull();
    });

    it('returns null when HMAC is tampered', () => {
      const { state, cookieValue } = generateSsoState({
        accountId: 'a',
        providerId: 'p',
        redirectTo: '/',
      });
      const tampered = `${cookieValue.slice(0, -4)}ffff`;
      expect(verifySsoState(state, tampered)).toBeNull();
    });

    it('returns null when HMAC has wrong length', () => {
      const { state } = generateSsoState({
        accountId: 'a',
        providerId: 'p',
        redirectTo: '/',
      });
      expect(verifySsoState(state, `${state}.short`)).toBeNull();
    });

    it('returns null for valid HMAC but malformed payload shape', () => {
      const badState = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url');
      const hmac = crypto.createHmac('sha256', SECRET).update(badState).digest('hex');
      expect(verifySsoState(badState, `${badState}.${hmac}`)).toBeNull();
    });

    it('throws when REVEALUI_SECRET is missing during verify', () => {
      const { state, cookieValue } = generateSsoState({
        accountId: 'a',
        providerId: 'p',
        redirectTo: '/',
      });
      delete process.env.REVEALUI_SECRET;
      expect(() => verifySsoState(state, cookieValue)).toThrow('REVEALUI_SECRET');
    });
  });
});
