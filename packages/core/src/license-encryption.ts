/**
 * AES-256-GCM encryption for license keys at rest.
 *
 * Format: enc:<iv-hex>:<ciphertext-hex>:<auth-tag-hex>
 * Falls back to plaintext when REVEALUI_LICENSE_ENCRYPTION_KEY is not set.
 *
 * Edge-compatible: uses the Web Crypto API (`crypto.subtle`) exclusively.
 * Safe to import from any runtime (Node, Edge, browser, Workers).
 *
 * Note: AES-GCM via Web Crypto bundles the auth tag onto the ciphertext
 * (last 16 bytes). The on-wire format is kept identical to the previous
 * node:crypto implementation for backward compatibility, so decrypt still
 * accepts `enc:iv:ciphertext:tag` and recombines ciphertext||tag before
 * passing to `crypto.subtle.decrypt`.
 */

const ENC_PREFIX = 'enc:';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Hex-encode a Uint8Array. */
function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] as number;
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

/** Hex-decode to Uint8Array. Throws on invalid input length. */
function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error('Invalid hex string');
    }
    out[i] = byte;
  }
  return out;
}

/**
 * Derives a 32-byte key from the env var value.
 * Accepts either a 64-char hex string or an arbitrary passphrase (hashed to 32 bytes).
 */
async function deriveKeyBytes(raw: string): Promise<Uint8Array> {
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return fromHex(raw);
  }
  const encoded = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return new Uint8Array(digest);
}

async function getCryptoKey(usage: 'encrypt' | 'decrypt'): Promise<CryptoKey | null> {
  const raw = process.env.REVEALUI_LICENSE_ENCRYPTION_KEY;
  if (!raw) return null;
  const keyBytes = await deriveKeyBytes(raw);
  // Cast through BufferSource: TS 5.7+ narrows Uint8Array to ArrayBufferLike on
  // some construction paths, but Web Crypto accepts any ArrayBufferView.
  return crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'AES-GCM' }, false, [
    usage,
  ]);
}

/**
 * Encrypt a plaintext license key.
 * Returns `enc:<iv>:<ciphertext>:<tag>` or the original plaintext if no key is configured.
 */
export async function encryptLicenseKey(plaintext: string): Promise<string> {
  const key = await getCryptoKey('encrypt');
  if (!key) return plaintext;

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintextBytes = new TextEncoder().encode(plaintext);

  const combined = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintextBytes),
  );

  // Web Crypto appends the 16-byte auth tag to the ciphertext. Split it back
  // out to preserve the original on-wire format.
  const ciphertext = combined.slice(0, combined.length - TAG_BYTES);
  const tag = combined.slice(combined.length - TAG_BYTES);

  return `${ENC_PREFIX}${toHex(iv)}:${toHex(ciphertext)}:${toHex(tag)}`;
}

/**
 * Decrypt a license key.
 * If the value doesn't start with `enc:`, returns it as-is (plaintext fallback).
 */
export async function decryptLicenseKey(stored: string): Promise<string> {
  if (!stored.startsWith(ENC_PREFIX)) {
    return stored; // plaintext  -  backward compatible
  }

  const key = await getCryptoKey('decrypt');
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
  const iv = fromHex(ivHex);
  const ciphertext = fromHex(ciphertextHex);
  const tag = fromHex(tagHex);

  if (iv.length !== IV_BYTES) {
    throw new Error(`Invalid IV length: expected ${IV_BYTES} bytes, got ${iv.length}`);
  }
  if (tag.length !== TAG_BYTES) {
    throw new Error(`Invalid auth tag length: expected ${TAG_BYTES} bytes, got ${tag.length}`);
  }

  // Recombine ciphertext||tag for Web Crypto's decrypt API.
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  let plaintextBuffer: ArrayBuffer;
  try {
    plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      combined as BufferSource,
    );
  } catch {
    // Web Crypto throws an opaque OperationError on tag mismatch / wrong key.
    // Normalize to a descriptive error matching the old node:crypto behavior.
    throw new Error('Unsupported state or unable to authenticate data');
  }

  return new TextDecoder().decode(plaintextBuffer);
}

/**
 * Check whether a stored license key value is encrypted.
 */
export function isEncryptedLicenseKey(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}
