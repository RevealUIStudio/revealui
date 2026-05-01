import type { RequestContext } from '@revealui/auth/server';
import { getClientIp } from '@revealui/security';
import type { Context } from 'hono';

/**
 * Extract request context (IP + user-agent) from a Hono Context for session
 * binding validation.
 *
 * Mirrors `apps/admin/src/lib/utils/request-context.ts` so the Hono API and
 * the Next.js admin surface apply the same binding check against a stolen
 * session cookie. Without passing this to `getSession(...)`, a cookie lifted
 * from one device would stay valid against the API from any UA / IP.
 *
 * Uses `getClientIp` from `@revealui/security/request-ip` (trusted-proxy-aware
 * "rightmost untrusted" strategy) instead of taking the leftmost
 * X-Forwarded-For entry — that older approach was spoofable by any direct
 * client setting their own X-Forwarded-For header. See GAP-130.
 *
 * Contract preserved: `ipAddress` is `undefined` when the client IP cannot be
 * determined (no trusted proxy headers). `getClientIp` returns the literal
 * string `'unknown'` in that case; we convert to `undefined` so that
 * `validateSessionBinding`'s `if (ctx.ipAddress && session.ipAddress && …)`
 * short-circuits the way it always has when no IP was available.
 */
export function extractRequestContext(c: Context): RequestContext {
  const ip = getClientIp(c.req.raw);
  return {
    userAgent: c.req.header('user-agent') ?? undefined,
    ipAddress: ip === 'unknown' ? undefined : ip,
  };
}
