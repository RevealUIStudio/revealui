/**
 * Rate Limiting Utilities
 *
 * Simple in-memory rate limiting for authentication endpoints.
 * For production, consider using Redis or a dedicated rate limiting service.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store (reset on server restart)
// In production, use Redis or similar
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
  blockDurationMs?: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes block after max attempts
}

/**
 * Checks if an action should be rate limited
 *
 * @param key - Rate limit key (e.g., email, IP address)
 * @param config - Rate limit configuration
 * @returns True if rate limited, false otherwise
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  // Clean up expired entries
  if (entry && entry.resetAt < now) {
    rateLimitStore.delete(key)
  }

  // Get or create entry
  const currentEntry = rateLimitStore.get(key) || {
    count: 0,
    resetAt: now + config.windowMs,
  }

  // Check if blocked
  if (config.blockDurationMs && currentEntry.count >= config.maxAttempts) {
    const blockUntil = currentEntry.resetAt + (config.blockDurationMs - config.windowMs)
    if (now < blockUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: blockUntil,
      }
    }
    // Block expired, reset
    currentEntry.count = 0
    currentEntry.resetAt = now + config.windowMs
  }

  // Check if within window
  if (currentEntry.count >= config.maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: currentEntry.resetAt,
    }
  }

  // Increment and update
  currentEntry.count++
  rateLimitStore.set(key, currentEntry)

  return {
    allowed: true,
    remaining: config.maxAttempts - currentEntry.count,
    resetAt: currentEntry.resetAt,
  }
}

/**
 * Resets rate limit for a key
 *
 * @param key - Rate limit key
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key)
}

/**
 * Gets rate limit status for a key
 *
 * @param key - Rate limit key
 * @param config - Rate limit configuration
 * @returns Rate limit status
 */
export function getRateLimitStatus(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { count: number; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    return {
      count: 0,
      remaining: config.maxAttempts,
      resetAt: now + config.windowMs,
    }
  }

  return {
    count: entry.count,
    remaining: Math.max(0, config.maxAttempts - entry.count),
    resetAt: entry.resetAt,
  }
}
