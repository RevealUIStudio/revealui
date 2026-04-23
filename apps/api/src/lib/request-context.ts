import type { RequestContext } from '@revealui/auth/server';
import type { Context } from 'hono';

/**
 * Extract request context (IP + user-agent) from a Hono Context for session
 * binding validation.
 *
 * Mirrors `apps/admin/src/lib/utils/request-context.ts` so the Hono API and
 * the Next.js admin surface apply the same binding check against a stolen
 * session cookie. Without passing this to `getSession(...)`, a cookie lifted
 * from one device would stay valid against the API from any UA / IP.
 */
export function extractRequestContext(c: Context): RequestContext {
  return {
    userAgent: c.req.header('user-agent') ?? undefined,
    ipAddress:
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      undefined,
  };
}
