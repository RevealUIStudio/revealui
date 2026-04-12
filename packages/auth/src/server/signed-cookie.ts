/**
 * Signed Cookie Utility
 *
 * Signs and verifies JSON payloads for stateless storage in httpOnly cookies.
 * Used by MFA pre-auth flow and WebAuthn challenge flow.
 *
 * Format: base64url(JSON payload) + '.' + base64url(HMAC-SHA256 signature)
 */

import crypto from 'node:crypto';

/**
 * Sign a payload for storage in an httpOnly cookie.
 * Format: base64url(JSON payload) + '.' + base64url(HMAC-SHA256 signature)
 *
 * @param payload - Must include `expiresAt` (Unix ms timestamp)
 * @param secret - HMAC signing key (e.g., REVEALUI_SECRET)
 * @returns Signed string safe for cookie value
 */
export function signCookiePayload<T extends { expiresAt: number }>(
  payload: T,
  secret: string,
): string {
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson).toString('base64url');

  // lgtm[js/insufficient-password-hash] - HMAC-SHA256 for cookie payload signing, not password hashing
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  const signatureB64 = signature.toString('base64url');

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Verify and decode a signed cookie payload.
 * Returns null if: signature invalid, expired, or malformed.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param signed - Signed cookie string from `signCookiePayload`
 * @param secret - HMAC signing key (must match the one used to sign)
 * @returns Decoded payload or null if invalid
 */
export function verifyCookiePayload<T extends { expiresAt: number }>(
  signed: string,
  secret: string,
): T | null {
  try {
    if (!signed) {
      return null;
    }

    const parts = signed.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [payloadB64, signatureB64] = parts as [string, string];

    // Recompute the expected signature
    // lgtm[js/insufficient-password-hash] - HMAC-SHA256 for cookie verification, not password hashing
    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadB64).digest();

    const actualSignature = Buffer.from(signatureB64, 'base64url');

    // Timing-safe comparison  -  buffers must be same length
    if (expectedSignature.length !== actualSignature.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(expectedSignature, actualSignature)) {
      return null;
    }

    // Signature valid  -  decode and parse the payload
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as T;

    // Check expiry
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    // Malformed input (bad base64, bad JSON, etc.) → null
    return null;
  }
}
