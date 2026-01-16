/**
 * Rate Limiting Utilities
 *
 * Rate limiting for authentication endpoints using storage abstraction.
 * Supports in-memory (dev), Redis (production), or database (fallback).
 */

import { getStorage } from './storage/index.js'

interface RateLimitEntry {
  count: number
  resetAt: number
}

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
 * Serialize rate limit entry to string
 */
function serializeEntry(entry: RateLimitEntry): string {
  return JSON.stringify(entry)
}

/**
 * Deserialize rate limit entry from string
 */
function deserializeEntry(data: string | null): RateLimitEntry | null {
  if (!data) {
    return null
  }

  try {
    return JSON.parse(data) as RateLimitEntry
  } catch {
    return null
  }
}

/**
 * Get storage key for rate limit entry
 */
function getStorageKey(key: string): string {
  return `rate_limit:${key}`
}

/**
 * Checks if an action should be rate limited
 *
 * @param key - Rate limit key (e.g., email, IP address)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const storage = getStorage()
  const storageKey = getStorageKey(key)
  const now = Date.now()

  // Get existing entry
  const entryData = await storage.get(storageKey)
  let entry = deserializeEntry(entryData)

  // Clean up expired entries
  if (entry && entry.resetAt < now) {
    await storage.del(storageKey)
    entry = null
  }

  // Get or create entry
  const currentEntry: RateLimitEntry = entry || {
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
  const ttlSeconds = Math.ceil((currentEntry.resetAt - now) / 1000)
  await storage.set(storageKey, serializeEntry(currentEntry), ttlSeconds)

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
export async function resetRateLimit(key: string): Promise<void> {
  const storage = getStorage()
  const storageKey = getStorageKey(key)
  await storage.del(storageKey)
}

/**
 * Gets rate limit status for a key
 *
 * @param key - Rate limit key
 * @param config - Rate limit configuration
 * @returns Rate limit status
 */
export async function getRateLimitStatus(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): Promise<{ count: number; remaining: number; resetAt: number }> {
  const storage = getStorage()
  const storageKey = getStorageKey(key)
  const now = Date.now()

  const entryData = await storage.get(storageKey)
  const entry = deserializeEntry(entryData)

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
