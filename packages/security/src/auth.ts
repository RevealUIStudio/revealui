/**
 * Authentication Utilities
 *
 * Two-factor authentication (TOTP). JWT-based auth lives in @revealui/auth
 * (session cookies). A prior OAuthClient / OAuthProviders surface here was
 * removed in fleet-redundancy P2-B: it had zero production importers, no PKCE,
 * and reimplemented auth that already lives under @revealui/auth. Use
 * @revealui/auth for OAuth/social sign-in.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Two-factor authentication
 */

/**
 * Base32 encode
 */
function base32Encode(buffer: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    if (byte === undefined) continue;
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }

  return result;
}

/**
 * Base32 decode (RFC 4648)  -  converts base32 string back to raw bytes.
 * Required by RFC 6238: the HMAC key must be the decoded binary secret,
 * not the base32-encoded string.
 */
function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let stripped = encoded.toUpperCase();
  let end = stripped.length;
  while (end > 0 && stripped[end - 1] === '=') end--;
  stripped = stripped.slice(0, end);
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of stripped) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Encode a 64-bit counter as an 8-byte big-endian buffer (RFC 4226 §5.2).
 * Standard authenticator apps expect this encoding  -  NOT a decimal string.
 */
function counterToBytes(counter: number): Buffer {
  const buf = Buffer.alloc(8);
  // Write as two 32-bit big-endian integers (JS numbers are safe up to 2^53)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  return buf;
}

/**
 * HMAC-SHA1 for TOTP (RFC 6238 §4).
 * Key: raw decoded bytes. Message: 8-byte big-endian counter.
 */
function totpHmac(decodedKey: Uint8Array, counterBuf: Buffer): Uint8Array {
  const hmacDigest = createHmac('sha1', decodedKey).update(counterBuf).digest();
  return new Uint8Array(hmacDigest);
}

/**
 * Generate TOTP secret
 */
function generateSecret(): string {
  const crypto = globalThis.crypto;
  if (!crypto) {
    throw new Error('Crypto API not available');
  }

  const buffer = new Uint8Array(20);
  crypto.getRandomValues(buffer);
  return base32Encode(buffer);
}

/**
 * Generate TOTP code (RFC 6238 compliant).
 * Secret is base32-encoded  -  decoded before HMAC.
 * Counter is encoded as 8-byte big-endian  -  matches all standard authenticator apps.
 */
function generateCode(secret: string, timestamp?: number): string {
  const time = Math.floor((timestamp || Date.now()) / 30000);
  const decodedKey = base32Decode(secret);
  const counterBuf = counterToBytes(time);
  const hmacDigest = totpHmac(decodedKey, counterBuf);
  // biome-ignore lint/style/noNonNullAssertion: HMAC-SHA1 always produces 20 bytes; buffer indices are guaranteed valid
  const offset = hmacDigest[hmacDigest.length - 1]! & 0x0f;
  // biome-ignore lint/style/noNonNullAssertion: HMAC-SHA1 always produces 20 bytes; buffer indices are guaranteed valid
  const b0 = hmacDigest[offset]! & 0x7f;
  // biome-ignore lint/style/noNonNullAssertion: HMAC-SHA1 always produces 20 bytes; buffer indices are guaranteed valid
  const b1 = hmacDigest[offset + 1]! & 0xff;
  // biome-ignore lint/style/noNonNullAssertion: HMAC-SHA1 always produces 20 bytes; buffer indices are guaranteed valid
  const b2 = hmacDigest[offset + 2]! & 0xff;
  // biome-ignore lint/style/noNonNullAssertion: HMAC-SHA1 always produces 20 bytes; buffer indices are guaranteed valid
  const b3 = hmacDigest[offset + 3]! & 0xff;
  const code = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) % 1000000;

  return code.toString().padStart(6, '0');
}

/**
 * Verify TOTP code
 */
function verifyCode(secret: string, code: string, window: number = 1): boolean {
  const timestamp = Date.now();

  // Check current and adjacent time windows
  for (let i = -window; i <= window; i++) {
    const testTime = timestamp + i * 30000;
    const testCode = generateCode(secret, testTime);

    if (
      testCode.length === code.length &&
      timingSafeEqual(Buffer.from(testCode), Buffer.from(code))
    ) {
      return true;
    }
  }

  return false;
}

export const TwoFactorAuth = {
  generateSecret,
  generateCode,
  verifyCode,
} as const;
