/**
 * Brute Force + Rate Limit Integration Tests
 *
 * Tests interactions between brute-force protection and rate limiting,
 * using in-memory storage to avoid database dependencies.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearFailedAttempts,
  isAccountLocked,
  recordFailedAttempt,
} from '../../server/brute-force.js'
import { checkRateLimit, resetRateLimit } from '../../server/rate-limit.js'
import { resetStorage } from '../../server/storage/index.js'

// Mock @revealui/config so storage falls back to in-memory
vi.mock('@revealui/config', () => ({
  default: { database: { url: undefined } },
}))

// Mock the logger to suppress noise
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

beforeEach(() => {
  resetStorage()
})

describe('Brute Force Protection', () => {
  it('account is not locked before any failed attempts', async () => {
    const status = await isAccountLocked('user@test.com')
    expect(status.locked).toBe(false)
  })

  it('records failed attempts and tracks count', async () => {
    const email = 'attacker@test.com'
    await recordFailedAttempt(email)
    await recordFailedAttempt(email)
    const status = await isAccountLocked(email)
    expect(status.attempts).toBeGreaterThanOrEqual(2)
  })

  it('locks account after maxAttempts (5 by default)', async () => {
    const email = 'locked@test.com'
    const cfg = { maxAttempts: 5, lockDurationMs: 30_000, windowMs: 60_000 }
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt(email, cfg)
    }
    const status = await isAccountLocked(email)
    expect(status.locked).toBe(true)
  })

  it('clearing attempts unlocks the account', async () => {
    const email = 'reset@test.com'
    const cfg = { maxAttempts: 3, lockDurationMs: 30_000, windowMs: 60_000 }
    for (let i = 0; i < 3; i++) {
      await recordFailedAttempt(email, cfg)
    }
    expect((await isAccountLocked(email)).locked).toBe(true)

    await clearFailedAttempts(email)
    expect((await isAccountLocked(email)).locked).toBe(false)
  })
})

describe('Rate Limiting', () => {
  it('allows requests within limit', async () => {
    const key = 'ip:192.168.1.1'
    const cfg = { maxAttempts: 5, windowMs: 60_000 }
    const result = await checkRateLimit(key, cfg)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks requests after maxAttempts', async () => {
    const key = 'ip:192.168.1.2'
    const cfg = { maxAttempts: 3, windowMs: 60_000 }
    // Consume all slots
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(key, cfg)
    }
    const blocked = await checkRateLimit(key, cfg)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('resetRateLimit allows requests again', async () => {
    const key = 'ip:192.168.1.3'
    const cfg = { maxAttempts: 2, windowMs: 60_000 }
    for (let i = 0; i < 2; i++) {
      await checkRateLimit(key, cfg)
    }
    expect((await checkRateLimit(key, cfg)).allowed).toBe(false)

    await resetRateLimit(key)
    expect((await checkRateLimit(key, cfg)).allowed).toBe(true)
  })
})

describe('Brute Force + Rate Limit Stacking', () => {
  it('a locked account is rejected by brute force check before rate limit is consulted', async () => {
    const email = 'stacked@test.com'
    const bruteConfig = { maxAttempts: 3, lockDurationMs: 30_000, windowMs: 60_000 }
    for (let i = 0; i < 3; i++) {
      await recordFailedAttempt(email, bruteConfig)
    }

    // Account is locked
    const bruteStatus = await isAccountLocked(email)
    expect(bruteStatus.locked).toBe(true)

    // Rate limit for same IP is also triggered
    const rateCfg = { maxAttempts: 3, windowMs: 60_000 }
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(`ip:10.0.0.1`, rateCfg)
    }
    const rateResult = await checkRateLimit('ip:10.0.0.1', rateCfg)
    expect(rateResult.allowed).toBe(false)

    // Both guards are active simultaneously
    expect(bruteStatus.locked).toBe(true)
    expect(rateResult.allowed).toBe(false)
  })

  it('clearing brute force does not affect rate limit state', async () => {
    const email = 'clear@test.com'
    const bruteConfig = { maxAttempts: 2, lockDurationMs: 10_000, windowMs: 60_000 }
    for (let i = 0; i < 2; i++) {
      await recordFailedAttempt(email, bruteConfig)
    }

    const rateCfg = { maxAttempts: 2, windowMs: 60_000 }
    for (let i = 0; i < 2; i++) {
      await checkRateLimit(email, rateCfg)
    }

    // Clear brute force only
    await clearFailedAttempts(email)
    expect((await isAccountLocked(email)).locked).toBe(false)

    // Rate limit still active (different storage key)
    const rateResult = await checkRateLimit(email, rateCfg)
    expect(rateResult.allowed).toBe(false)
  })
})
