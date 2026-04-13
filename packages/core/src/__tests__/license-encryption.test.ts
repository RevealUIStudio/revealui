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
    it('encrypts then decrypts to original plaintext', async () => {
      const plaintext = 'lic_pro_abc123_test';
      const encrypted = await encryptLicenseKey(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.startsWith('enc:')).toBe(true);
      expect(await decryptLicenseKey(encrypted)).toBe(plaintext);
    });

    it('handles long license keys', async () => {
      const plaintext = 'x'.repeat(1024);
      const encrypted = await encryptLicenseKey(plaintext);
      expect(await decryptLicenseKey(encrypted)).toBe(plaintext);
    });

    it('handles unicode characters', async () => {
      const plaintext = 'license_日本語_émojis_🔑';
      const encrypted = await encryptLicenseKey(plaintext);
      expect(await decryptLicenseKey(encrypted)).toBe(plaintext);
    });
  });

  describe('IV uniqueness', () => {
    it('produces different ciphertext for the same plaintext', async () => {
      const plaintext = 'same-key-same-plaintext';
      const a = await encryptLicenseKey(plaintext);
      const b = await encryptLicenseKey(plaintext);
      expect(a).not.toBe(b);
      expect(await decryptLicenseKey(a)).toBe(plaintext);
      expect(await decryptLicenseKey(b)).toBe(plaintext);
    });
  });

  describe('wrong key', () => {
    it('throws when decrypting with a different key', async () => {
      const encrypted = await encryptLicenseKey('secret-license');
      process.env.REVEALUI_LICENSE_ENCRYPTION_KEY = 'b'.repeat(64);
      await expect(decryptLicenseKey(encrypted)).rejects.toThrow();
    });
  });

  describe('corrupted ciphertext', () => {
    it('throws on tampered ciphertext', async () => {
      const encrypted = await encryptLicenseKey('test-license');
      const parts = encrypted.split(':');
      const hex = parts[2]!;
      const flipped = hex[0] === 'a' ? `b${hex.slice(1)}` : `a${hex.slice(1)}`;
      parts[2] = flipped;
      const tampered = parts.join(':');
      await expect(decryptLicenseKey(tampered)).rejects.toThrow();
    });

    it('throws on corrupted auth tag', async () => {
      const encrypted = await encryptLicenseKey('test-license');
      const parts = encrypted.split(':');
      const tag = parts[3]!;
      const flipped = tag[0] === 'a' ? `b${tag.slice(1)}` : `a${tag.slice(1)}`;
      parts[3] = flipped;
      const tampered = parts.join(':');
      await expect(decryptLicenseKey(tampered)).rejects.toThrow();
    });

    it('throws on malformed format (wrong number of parts)', async () => {
      await expect(decryptLicenseKey('enc:only-one-part')).rejects.toThrow('Malformed');
    });

    it('throws on invalid IV length', async () => {
      await expect(decryptLicenseKey('enc:aabb:ccdd:eeff')).rejects.toThrow('Invalid IV length');
    });
  });

  describe('no key fallback', () => {
    it('returns plaintext when no encryption key is set', async () => {
      delete process.env.REVEALUI_LICENSE_ENCRYPTION_KEY;
      const result = await encryptLicenseKey('plaintext-license');
      expect(result).toBe('plaintext-license');
    });

    it('throws when decrypting encrypted value without key', async () => {
      const encrypted = await encryptLicenseKey('test');
      delete process.env.REVEALUI_LICENSE_ENCRYPTION_KEY;
      await expect(decryptLicenseKey(encrypted)).rejects.toThrow(
        'REVEALUI_LICENSE_ENCRYPTION_KEY is not set',
      );
    });
  });

  describe('backward compatibility', () => {
    it('returns plaintext as-is when not encrypted', async () => {
      expect(await decryptLicenseKey('plain-license-key')).toBe('plain-license-key');
    });

    it('returns empty string as-is', async () => {
      expect(await decryptLicenseKey('')).toBe('');
    });
  });

  describe('isEncryptedLicenseKey', () => {
    it('returns true for encrypted values', async () => {
      const encrypted = await encryptLicenseKey('test');
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
    it('works with a 64-char hex key', async () => {
      process.env.REVEALUI_LICENSE_ENCRYPTION_KEY = TEST_KEY_HEX;
      const encrypted = await encryptLicenseKey('hex-key-test');
      expect(await decryptLicenseKey(encrypted)).toBe('hex-key-test');
    });

    it('works with a passphrase key', async () => {
      process.env.REVEALUI_LICENSE_ENCRYPTION_KEY = TEST_KEY_PASSPHRASE;
      const encrypted = await encryptLicenseKey('passphrase-test');
      expect(await decryptLicenseKey(encrypted)).toBe('passphrase-test');
    });

    it('hex key and passphrase produce different ciphertext', async () => {
      process.env.REVEALUI_LICENSE_ENCRYPTION_KEY = TEST_KEY_HEX;
      const encA = await encryptLicenseKey('cross-key');

      process.env.REVEALUI_LICENSE_ENCRYPTION_KEY = TEST_KEY_PASSPHRASE;
      await expect(decryptLicenseKey(encA)).rejects.toThrow();
    });
  });

  describe('empty string handling', () => {
    it('encrypts and decrypts empty string', async () => {
      const encrypted = await encryptLicenseKey('');
      expect(encrypted.startsWith('enc:')).toBe(true);
      expect(await decryptLicenseKey(encrypted)).toBe('');
    });

    it('returns empty string as-is without key', async () => {
      delete process.env.REVEALUI_LICENSE_ENCRYPTION_KEY;
      expect(await encryptLicenseKey('')).toBe('');
    });
  });
});
