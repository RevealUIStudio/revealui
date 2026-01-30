/**
 * Rate Limiting Middleware for API Routes
 *
 * Wraps API route handlers with rate limiting protection.
 */

import { checkRateLimit } from '@revealui/auth/server'
import { type NextRequest, NextResponse } from 'next/server'

export interface RateLimitOptions {
  maxAttempts?: number
  windowMs?: number
  keyPrefix?: string
}

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export const rateLimitConfigs = {
  auth: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  form: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
  },
  upload: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
}

/**
 * Creates a rate limit middleware function
 */
export function rateLimit(config: RateLimitConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      (request as any).ip ||
      'unknown'

    const rateLimitKey = `rate_limit:${ipAddress}`

    const result = await checkRateLimit(rateLimitKey, {
      maxAttempts: config.maxRequests,
      windowMs: config.windowMs,
    })

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(config.maxRequests),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': String(result.resetAt),
          },
        },
      )
    }

    return null
  }
}

/**
 * Creates a rate-limited API route handler
 *
 * @param handler - The API route handler function
 * @param options - Rate limit configuration
 * @returns Wrapped handler with rate limiting
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: RateLimitOptions = {},
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    // Get IP address for rate limiting
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      (request as any).ip ||
      'unknown'

    // Create rate limit key
    const keyPrefix = options.keyPrefix || 'api'
    const rateLimitKey = `${keyPrefix}:${ipAddress}`

    // Check rate limit
    const rateLimit = await checkRateLimit(rateLimitKey, {
      maxAttempts: options.maxAttempts || 10,
      windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    })

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(options.maxAttempts || 10),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetAt),
          },
        },
      )
    }

    // Add rate limit headers to response
    const response = await handler(request)
    response.headers.set('X-RateLimit-Limit', String(options.maxAttempts || 10))
    response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining))
    response.headers.set('X-RateLimit-Reset', String(rateLimit.resetAt))

    return response
  }
}
