/**
 * AES-256-GCM encryption for license keys at rest.
 *
 * Format: enc:<iv-hex>:<ciphertext-hex>:<auth-tag-hex>
 * Falls back to plaintext when REVEALUI_LICENSE_ENCRYPTION_KEY is not set.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ENC_PREFIX = 'enc:';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

/**
 * Derives a 32-byte key from the env var value.
 * Accepts either a 64-char hex string or an arbitrary passphrase (hashed to 32 bytes).
 */
function deriveKey(raw: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return createHash('sha256').update(raw).digest();
}

function getEncryptionKey(): Buffer | null {
  const raw = process.env.REVEALUI_LICENSE_ENCRYPTION_KEY;
  if (!raw) return null;
  return deriveKey(raw);
}

/**
 * Encrypt a plaintext license key.
 * Returns `enc:<iv>:<ciphertext>:<tag>` or the original plaintext if no key is configured.
 */
export function encryptLicenseKey(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Decrypt a license key.
 * If the value doesn't start with `enc:`, returns it as-is (plaintext fallback).
 */
export function decryptLicenseKey(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) {
    return stored; // plaintext  -  backward compatible
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error(
      'Encrypted license key found but REVEALUI_LICENSE_ENCRYPTION_KEY is not set. ' +
        'Cannot decrypt without the encryption key.',
    );
  }

  const parts = stored.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted license key  -  expected enc:<iv>:<ciphertext>:<tag>');
  }

  const [ivHex, ciphertextHex, tagHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  if (iv.length !== IV_BYTES) {
    throw new Error(`Invalid IV length: expected ${IV_BYTES} bytes, got ${iv.length}`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Check whether a stored license key value is encrypted.
 */
export function isEncryptedLicenseKey(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}
