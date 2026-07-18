/**
 * Preview-token minting and verification for visual edit sessions.
 *
 * A preview token authorizes a SINGLE read-only action: fetching a session's
 * draft overlays through `GET /sessions/:id/preview`. It never authorizes a
 * mutation. The marketing preview iframe is a different origin from the
 * dashboard, so it cannot carry the editor's session cookie; the signed token
 * is the only credential it holds, and it grants nothing but that one read.
 *
 * Format: `<payloadB64url>.<sigB64url>` where
 *   - payload  = base64url(JSON.stringify({ sid, exp }))  (exp = unix seconds)
 *   - sig      = base64url(HMAC-SHA256(secret, payloadB64url))
 *
 * Verification is timing-safe (node:crypto `timingSafeEqual`) and checks, in
 * order: structural shape, signature, expiry. The caller separately checks that
 * the token's `sid` matches the requested session and that the session is open.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from '@revealui/openapi';

/** Default token lifetime: 10 minutes. */
export const PREVIEW_TOKEN_TTL_SECONDS = 600;

/** Revvault path for the HMAC secret. Named in the fail-loud error below. */
const SECRET_VAULT_PATH = 'revealui/prod/preview-token-secret';

const PayloadSchema = z.object({
  sid: z.string().min(1),
  exp: z.number().int().positive(),
});

type Payload = z.infer<typeof PayloadSchema>;

export interface MintedToken {
  token: string;
  /** Expiry as unix seconds. */
  exp: number;
}

export type VerifyResult =
  | { ok: true; sid: string; exp: number }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

/**
 * Read the HMAC secret from the environment. Fails loudly, naming the revvault
 * path, when unset  -  no default, no fallback secret (secrets rule).
 */
export function getPreviewTokenSecret(): string {
  const secret = process.env.REVEALUI_PREVIEW_TOKEN_SECRET;
  if (!secret || secret.length === 0) {
    throw new Error(
      `REVEALUI_PREVIEW_TOKEN_SECRET is not set. Provision it from revvault: ${SECRET_VAULT_PATH}`,
    );
  }
  return secret;
}

function sign(secret: string, payloadB64: string): Buffer {
  return createHmac('sha256', secret).update(payloadB64).digest();
}

/** Mint a preview token for `sid`, expiring `ttlSeconds` from now. */
export function mintPreviewToken(
  secret: string,
  sid: string,
  ttlSeconds: number = PREVIEW_TOKEN_TTL_SECONDS,
): MintedToken {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: Payload = { sid, exp };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sigB64 = sign(secret, payloadB64).toString('base64url');
  return { token: `${payloadB64}.${sigB64}`, exp };
}

/**
 * Verify a preview token. Returns the decoded `{ sid, exp }` on success, or a
 * discriminated failure reason. Never throws on malformed input.
 */
export function verifyPreviewToken(
  secret: string,
  token: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): VerifyResult {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) {
    return { ok: false, reason: 'malformed' };
  }
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  if (token.indexOf('.', dot + 1) !== -1) {
    // More than one separator: not our format.
    return { ok: false, reason: 'malformed' };
  }

  const expected = sign(secret, payloadB64);
  let provided: Buffer;
  try {
    provided = Buffer.from(sigB64, 'base64url');
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  // Length guard first: timingSafeEqual throws on a length mismatch.
  if (provided.length !== expected.length) {
    return { ok: false, reason: 'bad_signature' };
  }
  if (!timingSafeEqual(provided, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const parsed = PayloadSchema.safeParse(decoded);
  if (!parsed.success) {
    return { ok: false, reason: 'malformed' };
  }
  if (parsed.data.exp <= nowSeconds) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, sid: parsed.data.sid, exp: parsed.data.exp };
}
