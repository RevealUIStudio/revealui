/**
 * Signed, short-TTL download tokens for Agency Kit fulfillments (GAP-448 P2-A).
 *
 * Token format: base64url(payload).base64url(hmac)
 * Payload: { fid: fulfillmentId, exp: unixSeconds }
 *
 * Uses REVEALUI_JOBS_WAKE_SECRET or REVEALUI_SECRET (server-only). Never mint
 * tokens on the client.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_SECONDS = 60 * 60 * 48; // 48h

function secret(): string {
  const s =
    process.env.REVEALUI_KIT_DOWNLOAD_SECRET ||
    process.env.REVEALUI_JOBS_WAKE_SECRET ||
    process.env.REVEALUI_SECRET;
  if (!s) {
    throw new Error(
      'Kit download tokens require REVEALUI_KIT_DOWNLOAD_SECRET, REVEALUI_JOBS_WAKE_SECRET, or REVEALUI_SECRET',
    );
  }
  return s;
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf;
  return b.toString('base64url');
}

function sign(payloadB64: string): string {
  return createHmac('sha256', secret()).update(payloadB64).digest('base64url');
}

export function mintKitDownloadToken(
  fulfillmentId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payloadB64 = b64url(JSON.stringify({ fid: fulfillmentId, exp }));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyKitDownloadToken(
  token: string,
): { ok: true; fulfillmentId: string } | { ok: false; reason: string } {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [payloadB64, sig] = parts;
  if (!(payloadB64 && sig)) return { ok: false, reason: 'malformed' };

  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad-signature' };
  }

  try {
    const raw = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      fid?: string;
      exp?: number;
    };
    if (!raw.fid || typeof raw.exp !== 'number') {
      return { ok: false, reason: 'bad-payload' };
    }
    if (raw.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, fulfillmentId: raw.fid };
  } catch {
    return { ok: false, reason: 'bad-payload' };
  }
}
