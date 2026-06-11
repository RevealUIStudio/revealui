/**
 * CSRF protection middleware for Hono.
 *
 * Defense-in-depth on top of sameSite:lax cookies, using the signed
 * double-submit pattern: tokens are HMAC-SHA256 over the SESSION COOKIE
 * VALUE plus a nonce. The admin app issues the token as the JS-readable
 * `revealui-csrf` cookie (admin proxy.ts) and attaches it as X-CSRF-Token;
 * admin's server-side forwarders mint the same shape per request. Validating
 * against the cookie value (not the DB session row id) is what lets every
 * REVEALUI_SECRET holder issue without a DB lookup — the browser never
 * learns anything it didn't already have, because the HMAC is one-way.
 *
 * Skip logic:
 * - Safe methods (GET, HEAD, OPTIONS)
 * - Requests without session cookies (API-key/server-to-server)
 * - Requests whose cookie did not resolve to an authenticated session
 *   (auth middleware owns that failure)
 * - Webhook routes (use signature verification)
 * - Cron routes (use X-Cron-Secret)
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';

export interface CsrfMiddlewareOptions {
  /** Cookie name to check for session presence (default: 'revealui-session') */
  cookieName?: string;
  /** Header name for CSRF token (default: 'X-CSRF-Token') */
  headerName?: string;
  /** Path prefixes to exempt from CSRF checks */
  exemptPaths?: string[];
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const DEFAULT_EXEMPT_PATHS = [
  '/api/webhooks/',
  '/api/cron/',
  '/api/v1/webhooks/',
  '/api/v1/cron/',
  '/.well-known/',
  '/a2a/',
];

/**
 * Generate a CSRF token bound to a session binding value — the raw
 * `revealui-session` cookie value, matching the admin issuer
 * (apps/admin/src/lib/utils/csrf-token.ts).
 *
 * Format: `<nonce-hex>:<hmac-hex>`
 */
export function generateCsrfToken(sessionBinding: string, secret: string): string {
  const nonce = randomBytes(16).toString('hex');
  const hmac = createHmac('sha256', secret).update(`${sessionBinding}:${nonce}`).digest('hex');
  return `${nonce}:${hmac}`;
}

/**
 * Validate a CSRF token against a session binding value using timing-safe
 * comparison.
 */
export function validateCsrfToken(token: string, sessionBinding: string, secret: string): boolean {
  const parts = token.split(':');
  if (parts.length !== 2) return false;

  const [nonce, providedHmac] = parts;
  if (!(nonce && providedHmac)) return false;

  const expectedHmac = createHmac('sha256', secret)
    .update(`${sessionBinding}:${nonce}`)
    .digest('hex');

  try {
    const a = Buffer.from(providedHmac, 'hex');
    const b = Buffer.from(expectedHmac, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Hono middleware that validates CSRF tokens on state-changing requests.
 */
export function csrfMiddleware(options?: CsrfMiddlewareOptions): MiddlewareHandler {
  const cookieName = options?.cookieName ?? 'revealui-session';
  const headerName = options?.headerName ?? 'X-CSRF-Token';
  const exemptPaths = options?.exemptPaths ?? DEFAULT_EXEMPT_PATHS;

  return async (c: Context, next) => {
    // Skip safe methods
    if (SAFE_METHODS.has(c.req.method)) {
      return next();
    }

    // Skip if no session cookie (non-browser client)
    const sessionCookie = getCookie(c, cookieName);
    if (!sessionCookie) {
      return next();
    }

    // Skip exempt paths
    const path = new URL(c.req.url).pathname;
    if (exemptPaths.some((prefix) => path.startsWith(prefix))) {
      return next();
    }

    // Get secret
    const secret = process.env.REVEALUI_SECRET;
    if (!secret) {
      return c.json({ error: 'Server configuration error' }, 500);
    }

    // Enforce only for authenticated sessions (set by auth middleware)  -
    // cookie-bearing requests that failed auth get their 401 downstream.
    const session = c.get('session') as { id?: string } | undefined;
    if (!session?.id) {
      return next();
    }

    // Read token from header
    const token = c.req.header(headerName);
    if (!token) {
      return c.json({ error: 'CSRF token missing' }, 403);
    }

    // Bind to the session COOKIE VALUE  -  the vocabulary every issuer speaks
    // (admin proxy.ts cookie, admin apiFetch, core APIClient, admin server-side
    // forwarders). Binding to session.id would require an issuance channel that
    // knows the DB row id; no browser-reachable issuer for that exists.
    if (!validateCsrfToken(token, sessionCookie, secret)) {
      return c.json({ error: 'CSRF token invalid' }, 403);
    }

    return next();
  };
}

/** Read a cookie value from the request */
function getCookie(c: Context, name: string): string | undefined {
  const header = c.req.header('Cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (key === name) {
      return trimmed.slice(eqIdx + 1);
    }
  }
  return undefined;
}
