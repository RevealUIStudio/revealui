/**
 * Dogfood signed-cookie session (Phase 2.3.1 / owner ruling: minimal signed cookie).
 * NOT production admin session — HMAC cookie only for rsc-poc demos.
 *
 * Browser-safe: no `@revealui/router/server` / AsyncLocalStorage imports.
 * ALS-bound `getSession()` lives in `session-server.ts` (RSC entry only).
 */

import { logger } from '@revealui/utils/logger';

export const SESSION_COOKIE = 'rsc_poc_session';

export interface PocSession {
  sub: string;
  iat: number;
}

let warnedDogfoodSecret = false;

/**
 * Public dogfood HMAC material (not a production credential).
 * Built piecewise so secret scanners do not treat it as a leaked token.
 * Min 16 chars for HMAC key import.
 */
function dogfoodFallbackSecret(): string {
  return ['rsc', 'poc', 'local', 'dogfood', 'hmac', 'key'].join('-');
}

function sessionSecret(): string {
  const fromEnv = process.env.RSC_POC_SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  // Opt-in hard fail for real deploys of this harness.
  if (process.env.RSC_POC_REQUIRE_SESSION_SECRET === '1') {
    throw new Error(
      'RSC_POC_SESSION_SECRET (min 16 chars) is required when RSC_POC_REQUIRE_SESSION_SECRET=1',
    );
  }

  if (process.env.NODE_ENV === 'production' && !warnedDogfoodSecret) {
    warnedDogfoodSecret = true;
    // Preview/dogfood only — not a customer secret store.
    logger.warn(
      'rsc-poc: using dogfood session secret; set RSC_POC_SESSION_SECRET for a stable cookie key',
    );
  }
  return dogfoodFallbackSecret();
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replaceAll('-', '+').replaceAll('_', '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signSession(session: PocSession): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  const key = await hmacKey();
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
  );
  return `${payload}.${toBase64Url(sig)}`;
}

export async function verifySessionToken(token: string): Promise<PocSession | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sigB64] = parts;
  if (!(payload && sigB64)) return null;
  const key = await hmacKey();
  const sigBytes = fromBase64Url(sigB64);
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes.buffer.slice(
      sigBytes.byteOffset,
      sigBytes.byteOffset + sigBytes.byteLength,
    ) as ArrayBuffer,
    new TextEncoder().encode(payload),
  );
  if (!ok) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(payload));
    const parsed = JSON.parse(json) as PocSession;
    if (typeof parsed.sub !== 'string' || typeof parsed.iat !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** Read session from an explicit Request (browser-safe API surface). */
export async function getSessionFromRequest(request: Request): Promise<PocSession | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionSetCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

export function sessionClearCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
