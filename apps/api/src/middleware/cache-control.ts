/**
 * Cache-Control Middleware
 *
 * Sets Cache-Control headers on API responses based on route sensitivity.
 * Applied at the app level to ensure all routes have appropriate headers.
 *
 * Categories:
 * - noStore: auth, billing, webhooks, GDPR — never cache
 * - noCache: health, cron, maintenance — don't cache, allow conditional requests
 * - shortCache: pricing, marketplace, content — short CDN cache with SWR
 * - privateCache: api-keys, license status — private browser-only cache
 */

import type { MiddlewareHandler } from 'hono';

const NO_STORE = 'no-store';
const NO_CACHE = 'no-cache, no-store, must-revalidate';

/**
 * Middleware that sets Cache-Control: no-store for sensitive endpoints.
 * Prevents any caching of auth tokens, billing data, or personal data.
 */
export function noStoreCacheMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.header('Cache-Control', NO_STORE);
  };
}

/**
 * Middleware that sets Cache-Control: no-cache for endpoints that must
 * always be fresh but aren't sensitive (health, cron, maintenance).
 */
export function noCacheCacheMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.header('Cache-Control', NO_CACHE);
  };
}

/**
 * Middleware that sets a short public CDN cache for cacheable GET endpoints.
 * Allows CDN to serve stale data while revalidating in the background.
 */
export function publicCacheMiddleware(options: {
  sMaxAge: number;
  staleWhileRevalidate?: number;
}): MiddlewareHandler {
  const { sMaxAge, staleWhileRevalidate = 30 } = options;
  const value = `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`;

  return async (c, next) => {
    await next();
    // Only cache successful GET responses
    if (c.req.method === 'GET' && c.res.status < 400) {
      c.header('Cache-Control', value);
    }
  };
}
