import { describe, expect, it } from 'vitest';
import { signCookiePayload, verifyCookiePayload } from '../signed-cookie.js';

const SECRET = 'test-secret-key-for-hmac-signing';

describe('signed-cookie', () => {
  describe('signCookiePayload', () => {
    it('returns a string with a dot separator', () => {
      const payload = { expiresAt: Date.now() + 60_000 };
      const signed = signCookiePayload(payload, SECRET);

      expect(typeof signed).toBe('string');
      expect(signed.split('.')).toHaveLength(2);
      expect(signed.split('.')[0]!.length).toBeGreaterThan(0);
      expect(signed.split('.')[1]!.length).toBeGreaterThan(0);
    });
  });

  describe('verifyCookiePayload', () => {
    it('returns the original data for a valid payload', () => {
      const payload = { expiresAt: Date.now() + 60_000, userId: 'user-123' };
      const signed = signCookiePayload(payload, SECRET);
      const result = verifyCookiePayload<typeof payload>(signed, SECRET);

      expect(result).toEqual(payload);
    });

    it('returns null for a tampered payload', () => {
      const payload = { expiresAt: Date.now() + 60_000, userId: 'user-123' };
      const signed = signCookiePayload(payload, SECRET);

      // Tamper with the payload portion (first segment)
      const [_payloadPart, sig] = signed.split('.');
      const tamperedPayload = Buffer.from(
        JSON.stringify({ expiresAt: Date.now() + 60_000, userId: 'attacker' }),
      ).toString('base64url');
      const tampered = `${tamperedPayload}.${sig}`;

      expect(verifyCookiePayload(tampered, SECRET)).toBeNull();
    });

    it('returns null for a wrong secret', () => {
      const payload = { expiresAt: Date.now() + 60_000 };
      const signed = signCookiePayload(payload, SECRET);

      expect(verifyCookiePayload(signed, 'wrong-secret')).toBeNull();
    });

    it('returns null for an expired payload', () => {
      const payload = { expiresAt: Date.now() - 1_000 }; // already expired
      const signed = signCookiePayload(payload, SECRET);

      expect(verifyCookiePayload(signed, SECRET)).toBeNull();
    });

    it('returns null for a malformed string', () => {
      expect(verifyCookiePayload('not-valid-base64url', SECRET)).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(verifyCookiePayload('', SECRET)).toBeNull();
    });

    it('returns null for a string with multiple dots', () => {
      expect(verifyCookiePayload('a.b.c', SECRET)).toBeNull();
    });
  });

  describe('round-trip', () => {
    it('preserves all payload fields', () => {
      const payload = {
        expiresAt: Date.now() + 300_000,
        userId: 'usr_abc',
        challenge: 'random-challenge-bytes',
        email: 'test@example.com',
        name: 'Test User',
      };
      const signed = signCookiePayload(payload, SECRET);
      const result = verifyCookiePayload<typeof payload>(signed, SECRET);

      expect(result).toEqual(payload);
      expect(result!.userId).toBe('usr_abc');
      expect(result!.challenge).toBe('random-challenge-bytes');
      expect(result!.email).toBe('test@example.com');
      expect(result!.name).toBe('Test User');
    });

    it('preserves extra fields beyond expiresAt', () => {
      const payload = {
        expiresAt: Date.now() + 60_000,
        foo: 42,
        nested: { bar: true },
      };
      const signed = signCookiePayload(payload, SECRET);
      const result = verifyCookiePayload<typeof payload>(signed, SECRET);

      expect(result).toEqual(payload);
      expect(result!.foo).toBe(42);
      expect(result!.nested).toEqual({ bar: true });
    });
  });
});
