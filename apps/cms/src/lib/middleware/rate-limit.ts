/**
 * Rate Limiting Middleware for API Routes
 *
 * Wraps API route handlers with rate limiting protection.
 */

import { checkRateLimit } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * NextRequest with optional IP property (added by edge runtime)
 */
interface NextRequestWithIP extends NextRequest {
  ip?: string;
}

export interface RateLimitOptions {
  maxAttempts?: number;
  windowMs?: number;
  keyPrefix?: string;
  /** If true, reject the request when the rate-limit store is unavailable (default: false) */
  failClosed?: boolean;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
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
};

/**
 * Creates a rate limit middleware function
 */
/**
 * Extract the trusted client IP from X-Forwarded-For.
 * Takes the rightmost entry (appended by the outermost trusted proxy — Vercel/Cloudflare),
 * not the leftmost (which is attacker-controlled in multi-hop scenarios).
 */
function extractTrustedIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const ips = xff.split(',').map((s) => s.trim());
    const last = ips[ips.length - 1];
    if (last) return last;
  }
  return request.headers.get('x-real-ip') || (request as NextRequestWithIP).ip || 'unknown';
}

export function rateLimit(config: RateLimitConfig, options?: { failClosed?: boolean }) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const ipAddress = extractTrustedIp(request);

    const rateLimitKey = `rate_limit:${ipAddress}`;

    try {
      const result = await checkRateLimit(rateLimitKey, {
        maxAttempts: config.maxRequests,
        windowMs: config.windowMs,
      });

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
        );
      }
    } catch (error) {
      if (options?.failClosed) {
        logger.error(
          'Rate limit check failed, rejecting request (fail-closed)',
          error instanceof Error ? error : undefined,
          { error: error instanceof Error ? error.message : String(error) },
        );
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again later.' },
          { status: 503 },
        );
      }
      logger.warn('Rate limit check failed, allowing request', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  };
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
    const ipAddress = extractTrustedIp(request);

    // Create rate limit key
    const keyPrefix = options.keyPrefix || 'api';
    const rateLimitKey = `${keyPrefix}:${ipAddress}`;

    // Check rate limit separately so errors don't catch handler failures
    let rateLimit: { allowed: boolean; remaining: number; resetAt: number } | null = null;
    try {
      rateLimit = await checkRateLimit(rateLimitKey, {
        maxAttempts: options.maxAttempts || 10,
        windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
      });
    } catch (error) {
      if (options.failClosed) {
        logger.error(
          'Rate limit check failed, rejecting request (fail-closed)',
          error instanceof Error ? error : undefined,
          { error: error instanceof Error ? error.message : String(error) },
        );
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again later.' },
          { status: 503 },
        );
      }
      logger.warn('Rate limit check failed, allowing request', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (rateLimit && !rateLimit.allowed) {
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
      );
    }

    // Call handler outside the rate-limit try/catch to avoid double-call on body-reading errors
    let response: NextResponse;
    try {
      response = await handler(request);
    } catch (handlerError) {
      logger.error(
        'Unhandled error in rate-limited handler',
        handlerError instanceof Error ? handlerError : new Error(String(handlerError)),
        { keyPrefix },
      );
      return NextResponse.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
        { status: 500 },
      );
    }

    if (rateLimit) {
      response.headers.set('X-RateLimit-Limit', String(options.maxAttempts || 10));
      response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
      response.headers.set('X-RateLimit-Reset', String(rateLimit.resetAt));
    }

    return response;
  };
}
