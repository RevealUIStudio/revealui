/**
 * Rate Limiting Middleware for API Routes (Simple In-Memory Implementation)
 *
 * Wraps API route handlers with rate limiting protection.
 */

import { type NextRequest, NextResponse } from 'next/server'

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

// Simple in-memory rate limit store
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

/**
 * Creates a rate limit middleware function
 */
export function rateLimit(config: RateLimitConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown'

    const rateLimitKey = `rate_limit:${ipAddress}`
    const now = Date.now()

    // Get or create rate limit entry
    let entry = rateLimitStore.get(rateLimitKey)

    // Reset if window expired
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
      }
      rateLimitStore.set(rateLimitKey, entry)
    }

    // Increment count
    entry.count++

    // Check if limit exceeded
    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(config.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(entry.resetAt),
          },
        },
      )
    }

    return null
  }
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean up every minute
