import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  decryptApiKey,
  decryptField,
  decryptFieldOrPassthrough,
  decryptWithKey,
  encryptApiKey,
  encryptField,
  encryptWithKey,
  isEncryptedField,
  redactApiKey,
} from '../crypto.js';

// ---------------------------------------------------------------------------
// Test KEK  -  64 hex chars (32 bytes / 256 bits)
// ---------------------------------------------------------------------------
const TEST_KEK = randomBytes(32).toString('hex');

describe('crypto  -  API key encryption', () => {
  const originalEnv = process.env.REVEALUI_KEK;

  beforeEach(() => {
    process.env.REVEALUI_KEK = TEST_KEK;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.REVEALUI_KEK = originalEnv;
    } else {
      delete process.env.REVEALUI_KEK;
    }
  });

  describe('encryptApiKey', () => {
    it('returns a dot-separated string with 3 parts', () => {
      const encrypted = encryptApiKey('sk-test-key-12345678');

      const parts = encrypted.split('.');
      expect(parts).toHaveLength(3);
    });

    it('produces different ciphertext for each call (random IV)', () => {
      const a = encryptApiKey('sk-test-key-12345678');
      const b = encryptApiKey('sk-test-key-12345678');

      expect(a).not.toBe(b);
    });

    it('throws when REVEALUI_KEK is not set', () => {
      delete process.env.REVEALUI_KEK;

      expect(() => encryptApiKey('sk-test')).toThrow(
        'REVEALUI_KEK environment variable is not set',
      );
    });

    it('throws when REVEALUI_KEK is wrong length', () => {
      process.env.REVEALUI_KEK = 'abc123';

      expect(() => encryptApiKey('sk-test')).toThrow('64 hex characters');
    });

    it('encrypts empty string without error', () => {
      const encrypted = encryptApiKey('');
      expect(encrypted.split('.')).toHaveLength(3);
    });

    it('encrypts long keys', () => {
      const longKey = `sk-${'a'.repeat(500)}`;
      const encrypted = encryptApiKey(longKey);
      expect(encrypted.split('.')).toHaveLength(3);
    });

    it('encrypts keys with special characters', () => {
      const key = 'sk-ant-api03-special/+=chars!@#$%^&*()';
      const encrypted = encryptApiKey(key);
      expect(encrypted.split('.')).toHaveLength(3);
    });
  });

  describe('decryptApiKey', () => {
    it('roundtrips encrypt → decrypt correctly', () => {
      const plaintext = 'sk-ant-api03-realkey12345678';
      const encrypted = encryptApiKey(plaintext);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('roundtrips with unicode content', () => {
      const plaintext = 'key-with-émojis-🔑-and-日本語';
      const encrypted = encryptApiKey(plaintext);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('throws on invalid format (missing parts)', () => {
      expect(() => decryptApiKey('just-one-part')).toThrow('Invalid encrypted format');
    });

    it('throws on invalid format (too many parts)', () => {
      expect(() => decryptApiKey('a.b.c.d')).toThrow('Invalid encrypted format');
    });

    it('throws on tampered ciphertext (GCM auth check)', () => {
      const encrypted = encryptApiKey('sk-original');
      const parts = encrypted.split('.');

      // Tamper with ciphertext
      const tampered = [parts[0], parts[1], 'AAAA'].join('.');

      expect(() => decryptApiKey(tampered)).toThrow();
    });

    it('throws on tampered auth tag', () => {
      const encrypted = encryptApiKey('sk-original');
      const parts = encrypted.split('.');

      // Tamper with auth tag (replace with valid-length but wrong tag)
      const fakeTag = randomBytes(16).toString('base64url');
      const tampered = [parts[0], fakeTag, parts[2]].join('.');

      expect(() => decryptApiKey(tampered)).toThrow();
    });

    it('throws when decrypting with wrong KEK', () => {
      const encrypted = encryptApiKey('sk-secret');

      // Change KEK
      process.env.REVEALUI_KEK = randomBytes(32).toString('hex');

      expect(() => decryptApiKey(encrypted)).toThrow();
    });

    it('throws on invalid IV length', () => {
      const shortIv = randomBytes(4).toString('base64url');
      const authTag = randomBytes(16).toString('base64url');
      const ciphertext = randomBytes(20).toString('base64url');

      expect(() => decryptApiKey(`${shortIv}.${authTag}.${ciphertext}`)).toThrow(
        'Invalid IV length',
      );
    });

    it('throws on invalid auth tag length', () => {
      const iv = randomBytes(12).toString('base64url');
      const shortAuthTag = randomBytes(4).toString('base64url');
      const ciphertext = randomBytes(20).toString('base64url');

      expect(() => decryptApiKey(`${iv}.${shortAuthTag}.${ciphertext}`)).toThrow(
        'Invalid auth tag length',
      );
    });
  });

  describe('redactApiKey', () => {
    it('shows last 4 characters with prefix', () => {
      expect(redactApiKey('sk-ant-api03-12345678')).toBe('...5678');
    });

    it('returns "..." for very short keys', () => {
      expect(redactApiKey('abc')).toBe('...');
      expect(redactApiKey('abcd')).toBe('...');
    });

    it('returns "..." for empty string', () => {
      expect(redactApiKey('')).toBe('...');
    });

    it('redacts 5-character key correctly', () => {
      expect(redactApiKey('12345')).toBe('...2345');
    });

    it('never exposes more than 4 characters', () => {
      const hint = redactApiKey('very-long-api-key-with-many-chars');
      expect(hint).toBe('...hars');
      // redactApiKey shows last 4 chars
      expect(hint.replace('...', '')).toHaveLength(4);
    });
  });

  describe('roundtrip edge cases', () => {
    it('roundtrips empty string', () => {
      const encrypted = encryptApiKey('');
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe('');
    });

    it('roundtrips large payload (10KB)', () => {
      const largeKey = `sk-${'x'.repeat(10_000)}`;
      const encrypted = encryptApiKey(largeKey);
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(largeKey);
      expect(decrypted).toHaveLength(10_003);
    });

    it('roundtrips string with null bytes', () => {
      const key = 'sk-test\x00embedded\x00nulls';
      const encrypted = encryptApiKey(key);
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(key);
    });

    it('roundtrips string with newlines and tabs', () => {
      const key = 'sk-test\n\twith\r\nwhitespace';
      const encrypted = encryptApiKey(key);
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(key);
    });

    it('roundtrips multi-byte unicode (CJK, emoji, combining chars)', () => {
      const key = 'sk-\u{1F680}\u{1F4BB}\u0301\u4E16\u754C';
      const encrypted = encryptApiKey(key);
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(key);
    });

    it('produces base64url-safe output (no +, /, or =)', () => {
      // Encrypt many times to ensure no base64 padding chars leak
      for (let i = 0; i < 20; i++) {
        const encrypted = encryptApiKey(`sk-iteration-${i}`);
        expect(encrypted).not.toMatch(/[+/=]/);
      }
    });

    it('different KEKs produce incompatible ciphertexts', () => {
      const kek1 = randomBytes(32).toString('hex');
      const kek2 = randomBytes(32).toString('hex');

      process.env.REVEALUI_KEK = kek1;
      const encrypted1 = encryptApiKey('same-plaintext');

      process.env.REVEALUI_KEK = kek2;
      expect(() => decryptApiKey(encrypted1)).toThrow();
    });

    it('encrypted output has correct IV length (12 bytes)', () => {
      const encrypted = encryptApiKey('sk-test');
      const ivB64 = encrypted.split('.')[0]!;
      const ivBuffer = Buffer.from(ivB64, 'base64url');
      expect(ivBuffer).toHaveLength(12);
    });

    it('encrypted output has correct auth tag length (16 bytes)', () => {
      const encrypted = encryptApiKey('sk-test');
      const authTagB64 = encrypted.split('.')[1]!;
      const authTagBuffer = Buffer.from(authTagB64, 'base64url');
      expect(authTagBuffer).toHaveLength(16);
    });
  });

  describe('encryptField / decryptField (generic)', () => {
    it('roundtrips a TOTP secret', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptField(secret);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(secret);
    });

    it('produces 3-part dot-separated output', () => {
      const encrypted = encryptField('any-secret');
      expect(encrypted.split('.')).toHaveLength(3);
    });

    it('produces different ciphertext per call (random IV)', () => {
      const a = encryptField('same');
      const b = encryptField('same');
      expect(a).not.toBe(b);
    });

    it('throws on tampered ciphertext', () => {
      const encrypted = encryptField('secret');
      const parts = encrypted.split('.');
      const tampered = [parts[0], parts[1], 'AAAA'].join('.');
      expect(() => decryptField(tampered)).toThrow();
    });
  });

  describe('isEncryptedField', () => {
    it('returns true for encrypted envelope format', () => {
      const encrypted = encryptField('test');
      expect(isEncryptedField(encrypted)).toBe(true);
    });

    it('returns false for plaintext Base32 TOTP secret', () => {
      expect(isEncryptedField('JBSWY3DPEHPK3PXP')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isEncryptedField('')).toBe(false);
    });

    it('returns false for single-part string', () => {
      expect(isEncryptedField('just-a-string')).toBe(false);
    });

    it('returns false for two-part string', () => {
      expect(isEncryptedField('part1.part2')).toBe(false);
    });

    it('returns false for four-part string', () => {
      expect(isEncryptedField('a.b.c.d')).toBe(false);
    });
  });

  describe('decryptFieldOrPassthrough', () => {
    it('decrypts encrypted values', () => {
      const encrypted = encryptField('TOTP_SECRET');
      expect(decryptFieldOrPassthrough(encrypted)).toBe('TOTP_SECRET');
    });

    it('passes through plaintext Base32 secrets', () => {
      expect(decryptFieldOrPassthrough('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP');
    });

    it('passes through simple strings', () => {
      expect(decryptFieldOrPassthrough('hello')).toBe('hello');
    });
  });

  describe('KEK validation', () => {
    it('non-hex chars in KEK produce a shorter key buffer, causing crypto error', () => {
      // Buffer.from('gg...', 'hex') silently drops invalid hex chars,
      // yielding a buffer shorter than 32 bytes. Node crypto then rejects it.
      process.env.REVEALUI_KEK = 'g'.repeat(64);
      expect(() => encryptApiKey('sk-test')).toThrow();
    });

    it('rejects KEK that is too short', () => {
      process.env.REVEALUI_KEK = 'aa'.repeat(16); // 32 hex chars = 16 bytes (too short)
      expect(() => encryptApiKey('sk-test')).toThrow('64 hex characters');
    });

    it('rejects KEK that is too long', () => {
      process.env.REVEALUI_KEK = 'aa'.repeat(48); // 96 hex chars = 48 bytes (too long)
      expect(() => encryptApiKey('sk-test')).toThrow('64 hex characters');
    });

    it('accepts valid 64-char hex KEK', () => {
      process.env.REVEALUI_KEK = 'ab'.repeat(32);
      expect(() => encryptApiKey('sk-test')).not.toThrow();
    });

    it('rejects empty string KEK', () => {
      process.env.REVEALUI_KEK = '';
      // Empty string is falsy in JS, so getKek() treats it as not set
      expect(() => encryptApiKey('sk-test')).toThrow();
    });
  });

  describe('encryptWithKey / decryptWithKey (parameterized for rotation)', () => {
    const KEY_A = randomBytes(32);
    const KEY_B = randomBytes(32);

    it('roundtrips with an explicit key (independent of process.env.REVEALUI_KEK)', () => {
      delete process.env.REVEALUI_KEK;
      const encrypted = encryptWithKey(KEY_A, 'rotation-payload');
      expect(decryptWithKey(KEY_A, encrypted)).toBe('rotation-payload');
    });

    it('throws when decrypting with a key different from the encrypt key', () => {
      const encrypted = encryptWithKey(KEY_A, 'secret');
      expect(() => decryptWithKey(KEY_B, encrypted)).toThrow();
    });

    it('rejects key buffers of the wrong length on encrypt', () => {
      const tooShort = randomBytes(16);
      expect(() => encryptWithKey(tooShort, 'x')).toThrow('must be exactly 32 bytes');
    });

    it('rejects key buffers of the wrong length on decrypt', () => {
      const encrypted = encryptWithKey(KEY_A, 'x');
      const tooLong = randomBytes(64);
      expect(() => decryptWithKey(tooLong, encrypted)).toThrow('must be exactly 32 bytes');
    });

    it('produces envelopes that the singleton decryptApiKey can read when key matches REVEALUI_KEK', () => {
      const sharedKeyHex = KEY_A.toString('hex');
      process.env.REVEALUI_KEK = sharedKeyHex;
      const encrypted = encryptWithKey(KEY_A, 'shared-payload');
      expect(decryptApiKey(encrypted)).toBe('shared-payload');
    });

    it('singleton encryptField produces envelopes that decryptWithKey can read with the same key', () => {
      const keyHex = KEY_A.toString('hex');
      process.env.REVEALUI_KEK = keyHex;
      const encrypted = encryptField('totp-secret');
      expect(decryptWithKey(KEY_A, encrypted)).toBe('totp-secret');
    });

    it('GCM auth tag mismatch throws on cross-key decrypt — the rotation idempotency signal', () => {
      // Rotation idempotency relies on this: try decrypt with NEW first; if
      // the auth tag verifies, the row is already under NEW. If it throws,
      // try OLD. This test pins the contract.
      const encrypted = encryptWithKey(KEY_A, 'value');
      let threw = false;
      try {
        decryptWithKey(KEY_B, encrypted);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });
});
