/**
 * @revealui/db/crypto  -  AES-256-GCM envelope encryption for stored API keys
 *
 * Uses a Key Encryption Key (KEK) sourced from the REVEALUI_KEK environment
 * variable (64 hex chars = 32 bytes). Each key is encrypted with a random
 * 96-bit IV; the output is a dot-separated base64url string:
 *
 *   <iv>.<authTag>.<ciphertext>
 *
 * The auth tag provides tamper detection (GCM authenticated encryption).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV  -  recommended for AES-GCM

function getKek(): Buffer {
  const kekHex = process.env.REVEALUI_KEK;
  if (!kekHex) {
    throw new Error('REVEALUI_KEK environment variable is not set');
  }
  if (kekHex.length !== 64) {
    throw new Error('REVEALUI_KEK must be exactly 64 hex characters (32 bytes / 256 bits)');
  }
  return Buffer.from(kekHex, 'hex');
}

// =============================================================================
// Parameterized Helpers (used directly by KEK rotation tooling)
// =============================================================================

/**
 * Encrypt with a caller-supplied 32-byte key.
 * Used by KEK rotation tooling so OLD_KEK and NEW_KEK can coexist in one
 * process without conflicting with the singleton `getKek()` reader. All
 * production encrypt/decrypt fns below delegate here.
 */
export function encryptWithKey(kek: Buffer, plaintext: string): string {
  if (kek.length !== 32) {
    throw new Error(`KEK buffer must be exactly 32 bytes, got ${kek.length}`);
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, kek, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

/**
 * Decrypt with a caller-supplied 32-byte key.
 * Throws if tampered (GCM auth tag mismatch), if the envelope is malformed,
 * or if the supplied key does not match the one used to encrypt. Auth-tag-
 * mismatch is the signal KEK rotation tooling uses to detect "encrypted
 * under a different key" — catch the throw, try the other key.
 */
export function decryptWithKey(kek: Buffer, encrypted: string): string {
  if (kek.length !== 32) {
    throw new Error(`KEK buffer must be exactly 32 bytes, got ${kek.length}`);
  }
  const parts = encrypted.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format — expected <iv>.<authTag>.<ciphertext>');
  }
  const [ivB64, authTagB64, ciphertextB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(authTagB64, 'base64url');
  const ciphertext = Buffer.from(ciphertextB64, 'base64url');
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }
  if (authTag.length !== 16) {
    throw new Error(`Invalid auth tag length: expected 16 bytes, got ${authTag.length}`);
  }
  const decipher = createDecipheriv(ALGORITHM, kek, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// =============================================================================
// Production Singletons (read REVEALUI_KEK from process.env)
// =============================================================================

/**
 * Encrypt a plaintext API key using AES-256-GCM.
 * Returns a dot-separated base64url string: `<iv>.<authTag>.<ciphertext>`
 */
export function encryptApiKey(plaintext: string): string {
  return encryptWithKey(getKek(), plaintext);
}

/**
 * Decrypt an encrypted API key produced by `encryptApiKey`.
 * Throws if tampered (GCM auth tag mismatch) or if KEK is wrong.
 */
export function decryptApiKey(encrypted: string): string {
  return decryptWithKey(getKek(), encrypted);
}

/**
 * Encrypt an arbitrary string field using AES-256-GCM.
 * Same algorithm as `encryptApiKey`; use for TOTP secrets, tokens, etc.
 */
export function encryptField(plaintext: string): string {
  return encryptWithKey(getKek(), plaintext);
}

/**
 * Decrypt a field encrypted by `encryptField`.
 * Throws on tamper (GCM auth tag mismatch) or wrong KEK.
 */
export function decryptField(encrypted: string): string {
  return decryptWithKey(getKek(), encrypted);
}

/**
 * Detect whether a stored value is in the encrypted envelope format.
 * Returns true for `<base64url>.<base64url>.<base64url>` with correct lengths.
 * Useful for rolling migration: read plaintext or encrypted transparently.
 */
export function isEncryptedField(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  // Validate that each part is valid base64url (non-empty, correct chars)
  const b64urlPattern = /^[A-Za-z0-9_-]+$/;
  return parts.every((p) => p !== undefined && p.length > 0 && b64urlPattern.test(p));
}

/**
 * Decrypt a field that may be plaintext (legacy) or encrypted (new).
 * If the value looks like an encrypted envelope, decrypts it.
 * Otherwise returns the plaintext as-is (for rolling migration).
 */
export function decryptFieldOrPassthrough(value: string): string {
  return isEncryptedField(value) ? decryptField(value) : value;
}

/**
 * Return a redacted hint showing only the last 4 characters of an API key.
 * Safe to store in plaintext and display in the UI.
 */
export function redactApiKey(plaintext: string): string {
  if (plaintext.length <= 4) return '...';
  return `...${plaintext.slice(-4)}`;
}
