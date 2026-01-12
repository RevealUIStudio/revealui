import { type NextRequest, NextResponse } from 'next/server'

/**
 * Simple in-memory rate limiter for authentication endpoints
 *
 * For production, consider using:
 * - Redis-based rate limiting
 * - Vercel Edge Config
 * - Third-party service (Upstash, etc.)
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 10 minutes
setInterval(
  () => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key)
      }
    }
  },
  10 * 60 * 1000,
)

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed within the window
   */
  maxRequests: number

  /**
   * Time window in milliseconds
   */
  windowMs: number

  /**
   * Key to identify the client (default: IP address)
   */
  keyGenerator?: (request: NextRequest) => string
}

/**
 * Rate limit middleware
 * Prevents brute force attacks on sensitive endpoints
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    maxRequests,
    windowMs,
    keyGenerator = (req) =>
      req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
  } = config

  return (request: NextRequest): Promise<NextResponse | null> => {
    const key = keyGenerator(request)
    const now = Date.now()

    const entry = rateLimitStore.get(key)

    if (!entry || entry.resetTime < now) {
      // First request or window expired, create new entry
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      })
      return Promise.resolve(null) // Allow request
    }

    if (entry.count >= maxRequests) {
      // Rate limit exceeded
      const resetIn = Math.ceil((entry.resetTime - now) / 1000)

      return Promise.resolve(
        NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Please try again in ${resetIn} seconds.`,
            retryAfter: resetIn,
          },
          {
            status: 429,
            headers: {
              'Retry-After': resetIn.toString(),
              'X-RateLimit-Limit': maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': entry.resetTime.toString(),
            },
          },
        ),
      )
    }

    // Increment counter
    entry.count++
    return Promise.resolve(null) // Allow request
  }
}

/**
 * Predefined rate limit configurations
 */
export const rateLimitConfigs = {
  // Strict rate limit for login attempts
  auth: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },

  // Moderate rate limit for API endpoints
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },

  // Rate limit for form submissions
  forms: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
  },

  // Rate limit for file uploads
  uploads: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },

  // Lenient rate limit for general requests
  general: {
    maxRequests: 1000,
    windowMs: 60 * 1000, // 1 minute
  },
} as const
