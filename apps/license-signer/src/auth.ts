/**
 * Per-call HMAC auth for the license-signer mint API (GAP-260 P4-2).
 *
 * Headers:
 *   X-RevealUI-Signer-Timestamp — unix seconds
 *   X-RevealUI-Signer-Signature — hex(hmac-sha256(secret, `${ts}.${METHOD}.${path}.${body}`))
 *
 * No fallback to REVEALUI_SECRET. Fail closed when secret missing or skew too large.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const SIGNER_TIMESTAMP_HEADER = 'x-revealui-signer-timestamp';
export const SIGNER_SIGNATURE_HEADER = 'x-revealui-signer-signature';

/** Max |now - timestamp| allowed (seconds). */
export const MAX_SKEW_SECONDS = 300;

export function getInvokeSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.REVEALUI_SIGNER_INVOKE_SECRET?.trim() ?? '';
  if (!secret) {
    throw new Error(
      'REVEALUI_SIGNER_INVOKE_SECRET is required (no REVEALUI_SECRET fallback). ' +
        'Set via revvault path revealui/prod/license/signer-invoke-secret.',
    );
  }
  return secret;
}

export function signMintRequest(
  secret: string,
  method: string,
  path: string,
  body: string,
  timestampSeconds: number,
): string {
  const payload = `${timestampSeconds}.${method.toUpperCase()}.${path}.${body}`;
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

export type AuthFailure =
  | 'missing_headers'
  | 'bad_timestamp'
  | 'skew'
  | 'bad_signature'
  | 'missing_secret';

export function verifyMintRequest(input: {
  secret: string;
  method: string;
  path: string;
  body: string;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  nowSeconds?: number;
  maxSkewSeconds?: number;
}): { ok: true } | { ok: false; reason: AuthFailure } {
  const tsRaw = input.timestampHeader?.trim() ?? '';
  const sigRaw = input.signatureHeader?.trim() ?? '';
  if (!(tsRaw && sigRaw)) {
    return { ok: false, reason: 'missing_headers' };
  }
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || ts <= 0) {
    return { ok: false, reason: 'bad_timestamp' };
  }
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxSkew = input.maxSkewSeconds ?? MAX_SKEW_SECONDS;
  if (Math.abs(now - ts) > maxSkew) {
    return { ok: false, reason: 'skew' };
  }
  const expected = signMintRequest(input.secret, input.method, input.path, input.body, ts);
  try {
    const a = Buffer.from(sigRaw, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || a.length === 0) {
      return { ok: false, reason: 'bad_signature' };
    }
    if (!timingSafeEqual(a, b)) {
      return { ok: false, reason: 'bad_signature' };
    }
  } catch {
    return { ok: false, reason: 'bad_signature' };
  }
  return { ok: true };
}
