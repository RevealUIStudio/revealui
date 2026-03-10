import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../storage/in-memory.js'

// ---------------------------------------------------------------------------
// Mock storage to use InMemoryStorage directly
// ---------------------------------------------------------------------------
const mockStorage = new InMemoryStorage()

vi.mock('../storage/index.js', () => ({
  getStorage: () => mockStorage,
}))

import type { RateLimitConfig } from '../rate-limit.js'
import { checkRateLimit, getRateLimitStatus, resetRateLimit } from '../rate-limit.js'

describe('rate-limit', () => {
  beforeEach(() => {
    mockStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // =========================================================================
  // checkRateLimit
  // =========================================================================
  describe('checkRateLimit', () => {
    it('allows the first request', async () => {
      const result = await checkRateLimit('test-key')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4) // default maxAttempts=5, minus 1
    })

    it('decrements remaining on each call', async () => {
      const config: RateLimitConfig = { maxAttempts: 3, windowMs: 60_000 }
      const r1 = await checkRateLimit('key', config)
      expect(r1.remaining).toBe(2)

      const r2 = await checkRateLimit('key', config)
      expect(r2.remaining).toBe(1)

      const r3 = await checkRateLimit('key', config)
      expect(r3.remaining).toBe(0)
    })

    it('blocks after maxAttempts reached', async () => {
      const config: RateLimitConfig = { maxAttempts: 2, windowMs: 60_000 }

      await checkRateLimit('key', config)
      await checkRateLimit('key', config)

      const blocked = await checkRateLimit('key', config)
      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
    })

    it('uses blockDurationMs when configured', async () => {
      const config: RateLimitConfig = {
        maxAttempts: 1,
        windowMs: 60_000,
        blockDurationMs: 120_000,
      }

      await checkRateLimit('key', config)

      const blocked = await checkRateLimit('key', config)
      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
      // resetAt should be ~120s in the future
      expect(blocked.resetAt).toBeGreaterThan(Date.now() + 100_000)
    })

    it('resets after window expires', async () => {
      const config: RateLimitConfig = { maxAttempts: 2, windowMs: 100 }

      await checkRateLimit('key', config)
      await checkRateLimit('key', config)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      const result = await checkRateLimit('key', config)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(1) // fresh window
    })

    it('isolates different keys', async () => {
      const config: RateLimitConfig = { maxAttempts: 1, windowMs: 60_000 }

      await checkRateLimit('key-a', config)
      const blockedA = await checkRateLimit('key-a', config)
      expect(blockedA.allowed).toBe(false)

      const allowedB = await checkRateLimit('key-b', config)
      expect(allowedB.allowed).toBe(true)
    })

    it('returns a resetAt timestamp in the future', async () => {
      const result = await checkRateLimit('key')
      expect(result.resetAt).toBeGreaterThan(Date.now() - 1000)
    })

    it('handles default config correctly', async () => {
      // Default: maxAttempts=5, windowMs=15min, blockDurationMs=30min
      const result = await checkRateLimit('key')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })
  })

  // =========================================================================
  // resetRateLimit
  // =========================================================================
  describe('resetRateLimit', () => {
    it('clears rate limit state for a key', async () => {
      const config: RateLimitConfig = { maxAttempts: 1, windowMs: 60_000 }
      await checkRateLimit('key', config)

      await resetRateLimit('key')

      const result = await checkRateLimit('key', config)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(0) // 1 maxAttempt minus 1
    })

    it('does not throw when resetting a nonexistent key', async () => {
      await expect(resetRateLimit('nonexistent')).resolves.toBeUndefined()
    })

    it('does not affect other keys', async () => {
      const config: RateLimitConfig = { maxAttempts: 2, windowMs: 60_000 }
      await checkRateLimit('key-a', config)
      await checkRateLimit('key-b', config)

      await resetRateLimit('key-a')

      const statusB = await getRateLimitStatus('key-b', config)
      expect(statusB.count).toBe(1)
    })
  })

  // =========================================================================
  // getRateLimitStatus
  // =========================================================================
  describe('getRateLimitStatus', () => {
    it('returns zero count for fresh key', async () => {
      const status = await getRateLimitStatus('fresh')
      expect(status.count).toBe(0)
      expect(status.remaining).toBe(5) // default maxAttempts
    })

    it('reflects current count after requests', async () => {
      const config: RateLimitConfig = { maxAttempts: 5, windowMs: 60_000 }
      await checkRateLimit('key', config)
      await checkRateLimit('key', config)
      await checkRateLimit('key', config)

      const status = await getRateLimitStatus('key', config)
      expect(status.count).toBe(3)
      expect(status.remaining).toBe(2)
    })

    it('shows zero remaining when at max', async () => {
      const config: RateLimitConfig = { maxAttempts: 2, windowMs: 60_000 }
      await checkRateLimit('key', config)
      await checkRateLimit('key', config)

      const status = await getRateLimitStatus('key', config)
      expect(status.count).toBe(2)
      expect(status.remaining).toBe(0)
    })

    it('resets after window expires', async () => {
      const config: RateLimitConfig = { maxAttempts: 2, windowMs: 50 }
      await checkRateLimit('key', config)

      await new Promise((resolve) => setTimeout(resolve, 100))

      const status = await getRateLimitStatus('key', config)
      expect(status.count).toBe(0)
      expect(status.remaining).toBe(2)
    })

    it('uses custom config for remaining calculation', async () => {
      const config: RateLimitConfig = { maxAttempts: 10, windowMs: 60_000 }
      await checkRateLimit('key', config)

      const status = await getRateLimitStatus('key', config)
      expect(status.remaining).toBe(9)
    })

    it('returns a resetAt timestamp', async () => {
      const status = await getRateLimitStatus('key')
      expect(typeof status.resetAt).toBe('number')
      expect(status.resetAt).toBeGreaterThan(Date.now() - 1000)
    })
  })
})
