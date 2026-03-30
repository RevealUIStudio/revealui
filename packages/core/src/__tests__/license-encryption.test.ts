import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  decryptLicenseKey,
  encryptLicenseKey,
  isEncryptedLicenseKey,
} from '../license-encryption.js';

const TEST_KEY_HEX = 'a'.repeat(64); // valid 64-char hex key
const TEST_KEY_PASSPHRASE = 'my-secret-passphrase';

describe('license-encryption', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.REVEALUI_LICENSE_ENCRYPTION_KEY;
    process.env.REVEALUI_LICENSE_ENCRYPTION_KEY = TEST_KEY_HEX;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.REVEALUI_LICENSE_ENCRYPTION_KEY;
    } else {
      process.env.REVEALUI_LICENSE_ENCRYPTION_KEY = originalKey;
    }
  });

  describe('round-trip', () => {
    it('encrypts then decrypts to original plaintext', () => {
      const plaintext = 'lic_pro_abc123_test';
      const encrypted = encryptLicenseKey(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.startsWith('enc:')).toBe(true);
      expect(decryptLicenseKey(encrypted)).toBe(plaintext);
    });

    it('handles long license keys', () => {
      const plaintext = 'x'.repeat(1024);
      const encrypted = encryptLicenseKey(plaintext);
      expect(decryptLicenseKey(encrypted)).toBe(plaintext);
    });

    it('handles unicode characters', () => {
      const plaintext = 'license_日本語_émojis_🔑';
      const encrypted = encryptLicenseKey(plaintext);
      expect(decryptLicenseKey(encrypted)).toBe(plaintext);
    });
  });

  describe('IV uniqueness', () => {
    it('produces different ciphertext for the same plaintext', () => {
      const plaintext = 'same-key-same-plaintext';
      const a = encryptLicenseKey(plaintext);
      const b = encryptLicenseKey(plaintext);
      expect(a).not.toBe(b);
      expect(decryptLicenseKey(a)).toBe(plaintext);
      expect(decryptLicenseKey(b)).toBe(plaintext);
    });
  });

  describe('wrong key', () => {
    it('throws when decrypting with a different key', () => {
      const encrypted = encryptLicenseKey('secret-license');
      process.env.REVEALUI_LICENSE_ENCRYPTION_KEY = 'b'.repeat(64);
      expect(() => decryptLicenseKey(encrypted)).toThrow();
    });
  });

  describe('corrupted ciphertext', () => {
    it('throws on tampered ciphertext', () => {
      const encrypted = encryptLicenseKey('test-license');
      const parts = encrypted.split(':');
      const hex = parts[2]!;
      const flipped = hex[0] === 'a' ? `b${hex.slice(1)}` : `a${hex.slice(1)}`;
      parts[2] = flipped;
      const tampered = parts.join(':');
      expect(() => decryptLicenseKey(tampered)).toThrow();
    });

    it('throws on corrupted auth tag', () => {
      const encrypted = encryptLicenseKey('test-license');
      const parts = encrypted.split(':');
      const tag = parts[3]!;
      const flipped = tag[0] === 'a' ? `b${tag.slice(1)}` : `a${tag.slice(1)}`;
      parts[3] = flipped;
      const tampered = parts.join(':');
      expect(() => decryptLicenseKey(tampered)).toThrow();
    });

    it('throws on malformed format (wrong number of parts)', () => {
      expect(() => decryptLicenseKey('enc:only-one-part')).toThrow('Malformed');
    });

    it('throws on invalid IV length', () => {
      expect(() => decryptLicenseKey('enc:aabb:ccdd:eeff')).toThrow('Invalid IV length');
    });
  });

  describe('no key fallback', () => {
    it('returns plaintext when no encryption key is set', () => {
      delete process.env.REVEALUI_LICENSE_ENCRYPTION_KEY;
      const result = encryptLicenseKey('plaintext-license');
      expect(result).toBe('plaintext-license');
    });

    it('throws when decrypting encrypted value without key', () => {
      const encrypted = encryptLicenseKey('test');
      delete process.env.REVEALUI_LICENSE_ENCRYPTION_KEY;
      expect(() => decryptLicenseKey(encrypted)).toThrow(
        'REVEALUI_LICENSE_ENCRYPTION_KEY is not set',
      );
    });
  });

  describe('backward compatibility', () => {
    it('returns plaintext as-is when not encrypted', () => {
      expect(decryptLicenseKey('plain-license-key')).toBe('plain-license-key');
    });

    it('returns empty string as-is', () => {
      expect(decryptLicenseKey('')).toBe('');
    });
  });

  describe('isEncryptedLicenseKey', () => {
    it('returns true for encrypted values', () => {
      const encrypted = encryptLicenseKey('test');
      expect(isEncryptedLicenseKey(encrypted)).toBe(true);
    });

    it('returns false for plaintext', () => {
      expect(isEncryptedLicenseKey('plain-key')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isEncryptedLicenseKey('')).toBe(false);
    });
  });

  describe('key formats', () => {
    it('works with a 64-char hex key', () => {
      process.env.REVEALUI_LICENSE_ENCRYPTION_KEY = TEST_KEY_HEX;
      const encrypted = encryptLicenseKey('hex-key-test');
      expect(decryptLicenseKey(encrypted)).toBe('hex-key-test');
    });

    it('works with a passphrase key', () => {
      process.env.REVEALUI_LICENSE_ENCRYPTION_KEY = TEST_KEY_PASSPHRASE;
      const encrypted = encryptLicenseKey('passphrase-test');
      expect(decryptLicenseKey(encrypted)).toBe('passphrase-test');
    });

    it('hex key and passphrase produce different ciphertext', () => {
      process.env.REVEALUI_LICENSE_ENCRYPTION_KEY = TEST_KEY_HEX;
      const encA = encryptLicenseKey('cross-key');

      process.env.REVEALUI_LICENSE_ENCRYPTION_KEY = TEST_KEY_PASSPHRASE;
      expect(() => decryptLicenseKey(encA)).toThrow();
    });
  });

  describe('empty string handling', () => {
    it('encrypts and decrypts empty string', () => {
      const encrypted = encryptLicenseKey('');
      expect(encrypted.startsWith('enc:')).toBe(true);
      expect(decryptLicenseKey(encrypted)).toBe('');
    });

    it('returns empty string as-is without key', () => {
      delete process.env.REVEALUI_LICENSE_ENCRYPTION_KEY;
      expect(encryptLicenseKey('')).toBe('');
    });
  });
});
