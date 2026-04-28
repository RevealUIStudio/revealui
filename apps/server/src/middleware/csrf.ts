/**
 * CSRF protection middleware for Hono.
 *
 * Defense-in-depth on top of sameSite:lax cookies.
 * Generates HMAC-SHA256 tokens bound to session IDs.
 *
 * Skip logic:
 * - Safe methods (GET, HEAD, OPTIONS)
 * - Requests without session cookies (API-key/server-to-server)
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
 * Generate a CSRF token bound to a session ID.
 *
 * Format: `<nonce-hex>:<hmac-hex>`
 */
export function generateCsrfToken(sessionId: string, secret: string): string {
  const nonce = randomBytes(16).toString('hex');
  const hmac = createHmac('sha256', secret).update(`${sessionId}:${nonce}`).digest('hex');
  return `${nonce}:${hmac}`;
}

/**
 * Validate a CSRF token against a session ID using timing-safe comparison.
 */
export function validateCsrfToken(token: string, sessionId: string, secret: string): boolean {
  const parts = token.split(':');
  if (parts.length !== 2) return false;

  const [nonce, providedHmac] = parts;
  if (!(nonce && providedHmac)) return false;

  const expectedHmac = createHmac('sha256', secret).update(`${sessionId}:${nonce}`).digest('hex');

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

    // Get session ID from context (set by auth middleware)
    const session = c.get('session') as { id?: string } | undefined;
    const sessionId = session?.id;
    if (!sessionId) {
      // No authenticated session  -  skip CSRF (auth middleware will handle)
      return next();
    }

    // Read token from header or body
    const token = c.req.header(headerName);
    if (!token) {
      return c.json({ error: 'CSRF token missing' }, 403);
    }

    if (!validateCsrfToken(token, sessionId, secret)) {
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
