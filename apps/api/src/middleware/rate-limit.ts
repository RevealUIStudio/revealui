/**
 * Rate Limiting Middleware for Hono API
 *
 * Adapts the existing checkRateLimit from @revealui/auth for use with Hono.
 * Sets standard rate limit headers and returns 429 when exceeded.
 */

import { checkRateLimit } from '@revealui/auth/server'
import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

export interface RateLimitOptions {
  /** Maximum requests allowed in the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Key prefix for namespacing rate limit counters */
  keyPrefix?: string
}

export const rateLimitMiddleware = (options: RateLimitOptions): MiddlewareHandler => {
  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown'
    const key = `${options.keyPrefix || 'api'}:${ip}`

    const result = await checkRateLimit(key, {
      maxAttempts: options.maxRequests,
      windowMs: options.windowMs,
    })

    c.header('X-RateLimit-Limit', String(options.maxRequests))
    c.header('X-RateLimit-Remaining', String(result.remaining))
    c.header('X-RateLimit-Reset', String(result.resetAt))

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
      c.header('Retry-After', String(retryAfter))
      throw new HTTPException(429, { message: 'Too many requests. Please try again later.' })
    }

    await next()
  }
}
