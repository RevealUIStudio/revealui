/**
 * Rate Limiting Middleware for Hono API
 *
 * Adapts the existing checkRateLimit from @revealui/auth for use with Hono.
 * Sets standard rate limit headers and returns 429 when exceeded.
 *
 * Client IP extraction uses `getClientIp` from `@revealui/security`
 * (trusted-proxy-aware). Configured globally at boot via
 * `configureClientIp({ trustedProxyCount: 1 })` in `apps/server/src/index.ts`.
 * See revealui#838 — earlier left-most-XFF extraction was trivially
 * spoofable behind Vercel's edge.
 */

import { checkRateLimit } from '@revealui/auth/server';
import { getCurrentTier, type LicenseTier } from '@revealui/core/license';
import { getClientIp } from '@revealui/security';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export interface RateLimitOptions {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key prefix for namespacing rate limit counters */
  keyPrefix?: string;
  /** If true, allow requests through when rate-limit storage is unreachable (default: false) */
  failOpen?: boolean;
}

export interface TieredRateLimitOptions {
  /** Rate limits per tier. Falls back to 'free' if tier not found. */
  tiers: Record<LicenseTier, { maxRequests: number; windowMs: number }>;
  /** Key prefix for namespacing rate limit counters */
  keyPrefix?: string;
  /** If true, allow requests through when rate-limit storage is unreachable (default: false) */
  failOpen?: boolean;
}

export const rateLimitMiddleware = (options: RateLimitOptions): MiddlewareHandler => {
  return async (c, next) => {
    const ip = getClientIp(c.req.raw);
    const key = `${options.keyPrefix || 'api'}:${ip}`;

    try {
      const result = await checkRateLimit(key, {
        maxAttempts: options.maxRequests,
        windowMs: options.windowMs,
      });

      c.header('X-RateLimit-Limit', String(options.maxRequests));
      c.header('X-RateLimit-Remaining', String(result.remaining));
      c.header('X-RateLimit-Reset', String(result.resetAt));

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
        c.header('Retry-After', String(retryAfter));
        throw new HTTPException(429, { message: 'Too many requests. Please try again later.' });
      }
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      if (options.failOpen) {
        // Storage unreachable  -  allow request through without rate limit headers
        await next();
        return;
      }
      throw error;
    }

    await next();
  };
};

/**
 * Tier-aware rate limiting. Applies different limits based on the current license tier.
 * Includes the tier in the key so counters reset on tier change.
 */
export const tieredRateLimitMiddleware = (options: TieredRateLimitOptions): MiddlewareHandler => {
  return async (c, next) => {
    const tier = getCurrentTier();
    const config = options.tiers[tier] ?? options.tiers.free;

    const ip = getClientIp(c.req.raw);
    const key = `${options.keyPrefix || 'api'}:${tier}:${ip}`;

    try {
      const result = await checkRateLimit(key, {
        maxAttempts: config.maxRequests,
        windowMs: config.windowMs,
      });

      c.header('X-RateLimit-Limit', String(config.maxRequests));
      c.header('X-RateLimit-Remaining', String(result.remaining));
      c.header('X-RateLimit-Reset', String(result.resetAt));

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
        c.header('Retry-After', String(retryAfter));
        throw new HTTPException(429, { message: 'Too many requests. Please try again later.' });
      }
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      if (options.failOpen) {
        await next();
        return;
      }
      throw error;
    }

    await next();
  };
};
