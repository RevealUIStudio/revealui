import { getClientIp } from '@revealui/security';

/**
 * Extract request context (IP + user-agent) for session binding validation.
 *
 * Pass the result as the second argument to `getSession()` so the auth layer
 * can validate that the session matches the current request's origin.
 *
 * Uses `getClientIp` from `@revealui/security/request-ip` (trusted-proxy-aware
 * "rightmost untrusted" strategy) instead of taking the leftmost
 * X-Forwarded-For entry — that older approach was spoofable by any direct
 * client setting their own X-Forwarded-For header. See GAP-130.
 *
 * Contract preserved: `ipAddress` is `undefined` when the client IP cannot be
 * determined. `getClientIp` returns the string `'unknown'` in that case; we
 * convert to `undefined` so `validateSessionBinding` short-circuits the way
 * it always has when no IP was available.
 */
export function extractRequestContext(request: Request): {
  userAgent: string | undefined;
  ipAddress: string | undefined;
} {
  const ip = getClientIp(request);
  return {
    userAgent: request.headers.get('user-agent') ?? undefined,
    ipAddress: ip === 'unknown' ? undefined : ip,
  };
}
