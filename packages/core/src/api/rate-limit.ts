/**
 * API Rate Limiting
 *
 * Implements rate limiting to prevent API abuse
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '../observability/logger.js';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
  skip?: (request: NextRequest) => boolean; // Skip rate limiting
  handler?: (request: NextRequest) => NextResponse; // Custom handler for rate limit exceeded
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// WARNING: In-memory store  -  resets on every serverless cold start or process restart.
// This module is NOT used by any app in production (API uses apps/api/src/middleware/rate-limit.ts,
// admin uses @revealui/auth/server which is DB-backed). Exported for framework consumers only.
// Replace with a database-backed store before using in production.
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Default key generator (by IP address)
 */
function defaultKeyGenerator(request: NextRequest): string {
  // Try to get real IP from headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    const parts = forwarded.split(',');
    return parts[0]?.trim() || 'unknown';
  }

  if (realIp) {
    return realIp;
  }

  // Fallback to unknown (NextRequest doesn't have ip property)
  return 'unknown';
}

/**
 * Check if rate limit exceeded
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
} {
  const { windowMs, maxRequests, keyGenerator = defaultKeyGenerator, skip } = config;

  // Skip rate limiting if configured
  if (skip?.(request)) {
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests,
      resetTime: Date.now() + windowMs,
    };
  }

  // Get key
  const key = keyGenerator(request);

  // Get or create entry
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  // Reset if window expired
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, entry);
  }

  // Increment count
  entry.count++;

  // Check limit
  const allowed = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);

  return {
    allowed,
    limit: maxRequests,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Create rate limit middleware
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (request: NextRequest, next: () => Promise<NextResponse>) => {
    const result = checkRateLimit(request, config);

    // Set rate limit headers
    const response = result.allowed
      ? await next()
      : config.handler
        ? config.handler(request)
        : createRateLimitResponse(result);

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    return response;
  };
}

/**
 * Create rate limit exceeded response
 */
function createRateLimitResponse(result: {
  limit: number;
  remaining: number;
  resetTime: number;
}): NextResponse {
  const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);

  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      limit: result.limit,
      remaining: result.remaining,
      resetTime: new Date(result.resetTime).toISOString(),
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
      },
    },
  );
}

/**
 * Cleanup expired rate limit entries across all stores
 */
export function cleanupRateLimits(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  // Evict stale sliding window entries (no timestamps within last hour)
  for (const [key, entry] of slidingWindowStore.entries()) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < 3_600_000);
    if (entry.timestamps.length === 0) {
      slidingWindowStore.delete(key);
      cleaned++;
    }
  }

  // Evict stale token bucket entries (idle for more than 1 hour)
  for (const [key, entry] of tokenBucketStore.entries()) {
    if (now - entry.lastRefill > 3_600_000) {
      tokenBucketStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Start rate limit cleanup interval
 */
export function startRateLimitCleanup(intervalMs: number = 60000): NodeJS.Timeout {
  return setInterval(() => {
    const cleaned = cleanupRateLimits();
    if (cleaned > 0) {
      logger.info('Cleaned up expired rate limit entries', { count: cleaned });
    }
  }, intervalMs);
}

/**
 * Get rate limit stats
 */
export function getRateLimitStats() {
  const now = Date.now();
  let active = 0;
  let expired = 0;

  for (const entry of rateLimitStore.values()) {
    if (now > entry.resetTime) {
      expired++;
    } else {
      active++;
    }
  }

  return {
    total: rateLimitStore.size,
    active,
    expired,
  };
}

/**
 * Rate limit preset configuration
 */
export interface RateLimitPresetConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  maxRequests: number;
}

/**
 * Default rate limit presets (immutable reference copy)
 */
const DEFAULT_RATE_LIMIT_PRESETS: Record<string, RateLimitPresetConfig> = {
  // Very strict (10 requests per minute)
  veryStrict: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },

  // Strict (30 requests per minute)
  strict: {
    windowMs: 60 * 1000,
    maxRequests: 30,
  },

  // Standard (100 requests per minute)
  standard: {
    windowMs: 60 * 1000,
    maxRequests: 100,
  },

  // Relaxed (500 requests per minute)
  relaxed: {
    windowMs: 60 * 1000,
    maxRequests: 500,
  },

  // Per hour (1000 requests per hour)
  hourly: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 1000,
  },

  // Per day (10000 requests per day)
  daily: {
    windowMs: 24 * 60 * 60 * 1000,
    maxRequests: 10000,
  },
};

/** Mutable presets (overridable via configureRateLimitPresets) */
let rateLimitPresets: Record<string, RateLimitPresetConfig> = {
  ...DEFAULT_RATE_LIMIT_PRESETS,
};

/**
 * Override one or more rate limit presets.
 *
 * Unknown keys create new presets; existing keys are merged with defaults.
 */
export function configureRateLimitPresets(
  overrides: Record<string, Partial<RateLimitPresetConfig>>,
): void {
  for (const [key, override] of Object.entries(overrides)) {
    const base = DEFAULT_RATE_LIMIT_PRESETS[key] ?? {
      windowMs: 60_000,
      maxRequests: 100,
    };
    rateLimitPresets[key] = { ...base, ...override };
  }
}

/**
 * Get the current (possibly overridden) rate limit presets.
 */
export function getRateLimitPresets(): Readonly<Record<string, RateLimitPresetConfig>> {
  return rateLimitPresets;
}

/**
 * Reset all presets to their defaults.
 */
export function resetRateLimitPresets(): void {
  rateLimitPresets = { ...DEFAULT_RATE_LIMIT_PRESETS };
}

/**
 * Rate limit presets  -  backward-compatible accessor.
 *
 * Reads from the mutable `rateLimitPresets` so overrides from
 * `configureRateLimitPresets()` are reflected automatically.
 */
export const RATE_LIMIT_PRESETS = new Proxy({} as Record<string, RateLimitPresetConfig>, {
  get(_target, prop: string) {
    return rateLimitPresets[prop];
  },
  ownKeys() {
    return Object.keys(rateLimitPresets);
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    if (prop in rateLimitPresets) {
      return {
        configurable: true,
        enumerable: true,
        value: rateLimitPresets[prop],
      };
    }
    return undefined;
  },
  has(_target, prop: string) {
    return prop in rateLimitPresets;
  },
});

/**
 * Rate limit by user ID
 */
export function createUserRateLimit(config: Omit<RateLimitConfig, 'keyGenerator'>) {
  return createRateLimitMiddleware({
    ...config,
    keyGenerator: (request) => {
      // Get user ID from auth header or session
      const userId = request.headers.get('x-user-id') || 'anonymous';
      return `user:${userId}`;
    },
  });
}

/**
 * Rate limit by API key
 */
export function createAPIKeyRateLimit(config: Omit<RateLimitConfig, 'keyGenerator'>) {
  return createRateLimitMiddleware({
    ...config,
    keyGenerator: (request) => {
      const apiKey = request.headers.get('x-api-key') || 'unknown';
      return `apikey:${apiKey}`;
    },
  });
}

/**
 * Rate limit by endpoint
 */
export function createEndpointRateLimit(config: Omit<RateLimitConfig, 'keyGenerator'>) {
  return createRateLimitMiddleware({
    ...config,
    keyGenerator: (request) => {
      const ip = defaultKeyGenerator(request);
      const url = new URL(request.url);
      const path = url.pathname;
      return `${ip}:${path}`;
    },
  });
}

/**
 * Sliding window rate limiter
 */
interface SlidingWindowEntry {
  timestamps: number[];
}

const slidingWindowStore = new Map<string, SlidingWindowEntry>();

export function checkSlidingWindowRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
): {
  allowed: boolean;
  limit: number;
  remaining: number;
} {
  const { windowMs, maxRequests, keyGenerator = defaultKeyGenerator } = config;

  const key = keyGenerator(request);
  const now = Date.now();

  // Get or create entry
  let entry = slidingWindowStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    slidingWindowStore.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  // Check limit
  const allowed = entry.timestamps.length < maxRequests;

  if (allowed) {
    entry.timestamps.push(now);
  }

  return {
    allowed,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - entry.timestamps.length),
  };
}

/**
 * Token bucket rate limiter
 */
interface TokenBucketEntry {
  tokens: number;
  lastRefill: number;
}

const tokenBucketStore = new Map<string, TokenBucketEntry>();

export function checkTokenBucketRateLimit(
  request: NextRequest,
  config: RateLimitConfig & { refillRate: number },
): {
  allowed: boolean;
  limit: number;
  remaining: number;
} {
  const { maxRequests, refillRate, windowMs, keyGenerator = defaultKeyGenerator } = config;

  const key = keyGenerator(request);
  const now = Date.now();

  // Get or create entry
  let entry = tokenBucketStore.get(key);
  if (!entry) {
    entry = {
      tokens: maxRequests,
      lastRefill: now,
    };
    tokenBucketStore.set(key, entry);
  }

  // Refill tokens
  const timePassed = now - entry.lastRefill;
  const tokensToAdd = Math.floor((timePassed / windowMs) * refillRate);

  if (tokensToAdd > 0) {
    entry.tokens = Math.min(maxRequests, entry.tokens + tokensToAdd);
    entry.lastRefill = now;
  }

  // Check if tokens available
  const allowed = entry.tokens > 0;

  if (allowed) {
    entry.tokens--;
  }

  return {
    allowed,
    limit: maxRequests,
    remaining: entry.tokens,
  };
}

/**
 * Clear rate limit for specific key
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
  slidingWindowStore.delete(key);
  tokenBucketStore.delete(key);
}

/**
 * Clear all rate limits
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
  slidingWindowStore.clear();
  tokenBucketStore.clear();
}

/**
 * Get rate limit info for key
 */
export function getRateLimitInfo(key: string): RateLimitEntry | null {
  return rateLimitStore.get(key) || null;
}
