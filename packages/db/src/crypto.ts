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

/**
 * Encrypt a plaintext API key using AES-256-GCM.
 * Returns a dot-separated base64url string: `<iv>.<authTag>.<ciphertext>`
 */
export function encryptApiKey(plaintext: string): string {
  const kek = getKek();
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
 * Decrypt an encrypted API key produced by `encryptApiKey`.
 * Throws if tampered (GCM auth tag mismatch) or if KEK is wrong.
 */
export function decryptApiKey(encrypted: string): string {
  const kek = getKek();
  const parts = encrypted.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format  -  expected <iv>.<authTag>.<ciphertext>');
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

/**
 * Return a redacted hint showing only the last 4 characters of an API key.
 * Safe to store in plaintext and display in the UI.
 */
export function redactApiKey(plaintext: string): string {
  if (plaintext.length <= 4) return '...';
  return `...${plaintext.slice(-4)}`;
}
