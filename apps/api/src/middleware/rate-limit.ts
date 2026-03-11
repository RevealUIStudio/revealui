/**
 * Rate Limiting Middleware for Hono API
 *
 * Adapts the existing checkRateLimit from @revealui/auth for use with Hono.
 * Sets standard rate limit headers and returns 429 when exceeded.
 */

import { checkRateLimit } from '@revealui/auth/server';
import { getCurrentTier, type LicenseTier } from '@revealui/core/license';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export interface RateLimitOptions {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key prefix for namespacing rate limit counters */
  keyPrefix?: string;
}

export interface TieredRateLimitOptions {
  /** Rate limits per tier. Falls back to 'free' if tier not found. */
  tiers: Record<LicenseTier, { maxRequests: number; windowMs: number }>;
  /** Key prefix for namespacing rate limit counters */
  keyPrefix?: string;
}

/**
 * Extract the trusted client IP from X-Forwarded-For.
 * Takes the rightmost entry (appended by the outermost trusted proxy — Vercel/Cloudflare),
 * not the leftmost (which is attacker-controlled in multi-hop scenarios).
 */
function extractTrustedIp(c: { req: { header: (name: string) => string | undefined } }): string {
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const ips = xff.split(',').map((s) => s.trim());
    const last = ips[ips.length - 1];
    if (last) return last;
  }
  return c.req.header('x-real-ip') ?? 'unknown';
}

export const rateLimitMiddleware = (options: RateLimitOptions): MiddlewareHandler => {
  return async (c, next) => {
    const ip = extractTrustedIp(c);
    const key = `${options.keyPrefix || 'api'}:${ip}`;

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

    const ip = extractTrustedIp(c);
    const key = `${options.keyPrefix || 'api'}:${tier}:${ip}`;

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

    await next();
  };
};
