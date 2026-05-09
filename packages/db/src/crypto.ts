/**
 * @revealui/db/crypto  -  AES-256-GCM envelope encryption for stored API keys
 *
 * Uses a Key Encryption Key (KEK) sourced from environment variables (each
 * 64 hex chars = 32 bytes). Each plaintext is encrypted with a random 96-bit
 * IV; the output is a dot-separated base64url string:
 *
 *   <iv>.<authTag>.<ciphertext>
 *
 * The auth tag provides tamper detection (GCM authenticated encryption).
 *
 * Dual-key boot for zero-downtime KEK rotation:
 *
 * - `REVEALUI_KEK` is the steady-state key. When it's the only key set,
 *   encrypt + decrypt both use it.
 * - During rotation the operator sets `REVEALUI_KEK_NEXT` to the new key
 *   while keeping `REVEALUI_KEK` as the old key. New encrypts go under
 *   `REVEALUI_KEK_NEXT`; decrypts try `REVEALUI_KEK_NEXT` first and fall
 *   back to `REVEALUI_KEK` on auth-tag mismatch (the GCM signal that the
 *   row was encrypted under a different key).
 * - After the rotation tool re-encrypts every row under the new key, the
 *   operator promotes `REVEALUI_KEK_NEXT` → `REVEALUI_KEK` and removes
 *   `REVEALUI_KEK_NEXT`. No downtime.
 *
 * See `~/revfleet/.jv/docs/runbooks/rotate-kek.md` §Zero-downtime path for the
 * operator flow.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { logger } from '@revealui/utils/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV  -  recommended for AES-GCM
const KEK_HEX_LENGTH = 64; // 32 bytes / 256 bits

/**
 * Resolve the active KEK pair from process.env.
 *
 * Returns `{ primary, fallback? }` where:
 * - `primary` is the key new encrypts go under and the first key tried on
 *   decrypt. `REVEALUI_KEK_NEXT` if set, otherwise `REVEALUI_KEK`.
 * - `fallback` is the second key tried on decrypt when the primary fails the
 *   GCM auth check. Set only when both `REVEALUI_KEK_NEXT` and `REVEALUI_KEK`
 *   are configured (the dual-key transition window).
 *
 * Throws when no key is set, or when a configured key is not 64 hex chars.
 */
function getKekPair(): { primary: Buffer; fallback?: Buffer } {
  const nextHex = (process.env.REVEALUI_KEK_NEXT ?? '').trim();
  const kekHex = (process.env.REVEALUI_KEK ?? '').trim();

  if (!(nextHex || kekHex)) {
    throw new Error('REVEALUI_KEK environment variable is not set');
  }

  const primaryHex = nextHex || kekHex;
  const primaryName = nextHex ? 'REVEALUI_KEK_NEXT' : 'REVEALUI_KEK';
  if (primaryHex.length !== KEK_HEX_LENGTH) {
    throw new Error(`${primaryName} must be exactly 64 hex characters (32 bytes / 256 bits)`);
  }

  let fallbackHex: string | undefined;
  if (nextHex && kekHex) {
    if (kekHex.length !== KEK_HEX_LENGTH) {
      throw new Error(
        'REVEALUI_KEK must be exactly 64 hex characters (32 bytes / 256 bits) when set as fallback during dual-key rotation',
      );
    }
    fallbackHex = kekHex;
  }

  return {
    primary: Buffer.from(primaryHex, 'hex'),
    fallback: fallbackHex ? Buffer.from(fallbackHex, 'hex') : undefined,
  };
}

// =============================================================================
// Parameterized Helpers (used directly by KEK rotation tooling)
// =============================================================================

/**
 * Encrypt with a caller-supplied 32-byte key.
 * Used by KEK rotation tooling so OLD_KEK and NEW_KEK can coexist in one
 * process without conflicting with the singleton `getKekPair()` reader. All
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
 * or if the supplied key does not match the one used to encrypt. Auth-tag
 * mismatch is the signal the dual-key boot path uses to detect "encrypted
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

/**
 * Decrypt with the active primary key; on GCM auth-tag mismatch, retry with
 * the fallback (when configured). Logs a structured `kek-fallback-decrypt`
 * event on the fallback path so operators can confirm the rotation tool is
 * making progress (the event count should drop to 0 once every row is
 * re-encrypted under the new primary).
 *
 * Surfaces the primary error when no fallback is configured or both keys
 * fail (the primary error is the more accurate signal during rotation —
 * the fallback failing while primary fails too means the row is genuinely
 * unreadable, not a key-mismatch).
 */
function decryptWithFallback(encrypted: string): string {
  const { primary, fallback } = getKekPair();
  try {
    return decryptWithKey(primary, encrypted);
  } catch (primaryErr) {
    if (!fallback) throw primaryErr;
    try {
      const result = decryptWithKey(fallback, encrypted);
      logger.warn('KEK decrypt fell back to old key — rotation in flight', {
        event: 'kek-fallback-decrypt',
      });
      return result;
    } catch {
      throw primaryErr;
    }
  }
}

// =============================================================================
// Production Singletons (read REVEALUI_KEK[_NEXT] from process.env)
// =============================================================================

/**
 * Encrypt a plaintext API key using AES-256-GCM under the active primary KEK.
 * Returns a dot-separated base64url string: `<iv>.<authTag>.<ciphertext>`
 */
export function encryptApiKey(plaintext: string): string {
  return encryptWithKey(getKekPair().primary, plaintext);
}

/**
 * Decrypt an encrypted API key produced by `encryptApiKey`.
 * Tries the primary KEK first; on auth-tag mismatch, retries with the
 * fallback when configured. Throws on tamper or wrong KEK with no fallback.
 */
export function decryptApiKey(encrypted: string): string {
  return decryptWithFallback(encrypted);
}

/**
 * Encrypt an arbitrary string field using AES-256-GCM under the active
 * primary KEK. Same algorithm as `encryptApiKey`; use for TOTP secrets,
 * tokens, etc.
 */
export function encryptField(plaintext: string): string {
  return encryptWithKey(getKekPair().primary, plaintext);
}

/**
 * Decrypt a field encrypted by `encryptField`.
 * Tries the primary KEK first; on auth-tag mismatch, retries with the
 * fallback when configured.
 */
export function decryptField(encrypted: string): string {
  return decryptWithFallback(encrypted);
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
