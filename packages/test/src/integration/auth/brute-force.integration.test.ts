/**
 * Brute Force Protection Integration Tests
 *
 * PURPOSE: Verify brute force protection mechanisms work correctly
 *
 * CRITICAL CONTEXT: Brute force protection must work correctly to prevent:
 * - Account takeover via password guessing
 * - Credential stuffing attacks
 * - Automated login attempts
 *
 * TESTS:
 * - Account lockout after threshold (default 5 attempts)
 * - Lock expiration (default 30 minutes)
 * - Window expiration (default 15 minutes)
 * - Successful login clearing attempts
 * - Custom configuration support
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearFailedAttempts,
  getFailedAttemptCount,
  isAccountLocked,
  recordFailedAttempt,
} from '../../../../auth/src/server/brute-force.js'
import { generateUniqueTestEmail } from '../../utils/integration-helpers.js'

// Type for brute force configuration
interface BruteForceConfig {
  maxAttempts: number
  lockDurationMs: number
  windowMs: number
}

describe('Brute Force Protection Integration Tests', () => {
  let testEmail: string

  beforeEach(() => {
    // Generate unique email for each test to prevent interference
    testEmail = generateUniqueTestEmail('brute-force')
    // Clear all failed attempts before each test
    clearFailedAttempts(testEmail)
  })

  // =============================================================================
  // Account Lockout After Threshold
  // =============================================================================

  describe('Account Lockout After Threshold', () => {
    it('should lock account after 5 failed attempts (DEFAULT_CONFIG.maxAttempts)', async () => {
      // Act: Record 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(testEmail)
      }

      // Assert: Account should be locked
      const lockStatus = await isAccountLocked(testEmail)
      expect(lockStatus.locked).toBe(true)
      expect(lockStatus.attemptsRemaining).toBe(0)
      expect(lockStatus.lockUntil).toBeDefined()

      // Verify lockUntil is approximately 30 minutes in the future
      const now = Date.now()
      const lockUntil = lockStatus.lockUntil!
      const lockDuration = lockUntil - now
      const thirtyMinutes = 30 * 60 * 1000
      expect(lockDuration).toBeGreaterThan(thirtyMinutes - 5000) // Within 5 seconds
      expect(lockDuration).toBeLessThan(thirtyMinutes + 5000)
    })

    it('should NOT lock account after 4 failed attempts', async () => {
      // Act: Record 4 failed attempts
      for (let i = 0; i < 4; i++) {
        await recordFailedAttempt(testEmail)
      }

      // Assert: Account should not be locked
      const lockStatus = await isAccountLocked(testEmail)
      expect(lockStatus.locked).toBe(false)
      expect(lockStatus.attemptsRemaining).toBe(1)
      expect(lockStatus.lockUntil).toBeUndefined()
    })

    it('should track attemptsRemaining correctly as failures accumulate', async () => {
      // After 1 failure: attemptsRemaining = 4
      await recordFailedAttempt(testEmail)
      let lockStatus = await isAccountLocked(testEmail)
      expect(lockStatus.attemptsRemaining).toBe(4)

      // After 3 failures total: attemptsRemaining = 2
      await recordFailedAttempt(testEmail)
      await recordFailedAttempt(testEmail)
      lockStatus = await isAccountLocked(testEmail)
      expect(lockStatus.attemptsRemaining).toBe(2)

      // After 4 failures total: attemptsRemaining = 1
      await recordFailedAttempt(testEmail)
      lockStatus = await isAccountLocked(testEmail)
      expect(lockStatus.attemptsRemaining).toBe(1)
    })

    it('should return lockUntil timestamp when account is locked', async () => {
      // Act: Lock the account
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(testEmail)
      }

      // Assert: lockUntil should be set and be in the future
      const lockStatus = await isAccountLocked(testEmail)
      expect(lockStatus.locked).toBe(true)
      expect(lockStatus.lockUntil).toBeDefined()
      expect(lockStatus.lockUntil!).toBeGreaterThan(Date.now())
    })
  })

  // =============================================================================
  // Lock Expiration
  // =============================================================================

  describe('Lock Expiration', () => {
    it('should unlock account after lock duration expires', async () => {
      // Use custom config with short lock duration for testing
      const testConfig: BruteForceConfig = {
        maxAttempts: 3,
        lockDurationMs: 100, // 100ms for fast test
        windowMs: 15 * 60 * 1000,
      }

      // Lock the account
      for (let i = 0; i < 3; i++) {
        await recordFailedAttempt(testEmail, testConfig)
      }

      // Verify account is locked
      let lockStatus = await isAccountLocked(testEmail, testConfig)
      expect(lockStatus.locked).toBe(true)

      // Wait for lock to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Verify account is unlocked
      lockStatus = await isAccountLocked(testEmail, testConfig)
      expect(lockStatus.locked).toBe(false)
      expect(lockStatus.attemptsRemaining).toBe(testConfig.maxAttempts)
    })

    it('should reset attempt count after lock expires', async () => {
      // Use custom config with short lock duration
      const testConfig: BruteForceConfig = {
        maxAttempts: 3,
        lockDurationMs: 100,
        windowMs: 15 * 60 * 1000,
      }

      // Lock the account
      for (let i = 0; i < 3; i++) {
        await recordFailedAttempt(testEmail, testConfig)
      }

      // Wait for lock to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      // isAccountLocked() triggers the expiration check and deletes expired entries
      const lockStatus = await isAccountLocked(testEmail, testConfig)
      expect(lockStatus.locked).toBe(false)

      // After isAccountLocked() clears the expired entry, count should be 0
      const count = await getFailedAttemptCount(testEmail)
      expect(count).toBe(0)
    })
  })

  // =============================================================================
  // Window Expiration
  // =============================================================================

  describe('Window Expiration', () => {
    it('should reset failed attempts after window expires (15 minutes)', async () => {
      // Use custom config with short window for testing
      const testConfig: BruteForceConfig = {
        maxAttempts: 5,
        lockDurationMs: 30 * 60 * 1000,
        windowMs: 100, // 100ms for fast test
      }

      // Add 3 failures
      for (let i = 0; i < 3; i++) {
        await recordFailedAttempt(testEmail, testConfig)
      }

      // Verify count
      let count = await getFailedAttemptCount(testEmail)
      expect(count).toBe(3)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      // isAccountLocked() triggers the expiration check and deletes expired entries
      const lockStatus = await isAccountLocked(testEmail, testConfig)
      expect(lockStatus.locked).toBe(false)

      // After isAccountLocked() clears the expired entry, count should be 0
      count = await getFailedAttemptCount(testEmail)
      expect(count).toBe(0)
    })

    it('should restart window on first failure after expiration', async () => {
      // Use custom config with short window
      const testConfig: BruteForceConfig = {
        maxAttempts: 5,
        lockDurationMs: 30 * 60 * 1000,
        windowMs: 100,
      }

      // Add 3 failures
      for (let i = 0; i < 3; i++) {
        await recordFailedAttempt(testEmail, testConfig)
      }

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Add new failure (should start new window)
      await recordFailedAttempt(testEmail, testConfig)

      // Verify attemptsRemaining resets to 4 (maxAttempts - 1)
      const lockStatus = await isAccountLocked(testEmail, testConfig)
      expect(lockStatus.attemptsRemaining).toBe(4)
    })
  })

  // =============================================================================
  // Successful Login Clears Attempts
  // =============================================================================

  describe('Successful Login Clears Attempts', () => {
    it('should clear failed attempts on successful login', async () => {
      // Add 3 failures
      for (let i = 0; i < 3; i++) {
        await recordFailedAttempt(testEmail)
      }

      // Verify attempts recorded
      let count = await getFailedAttemptCount(testEmail)
      expect(count).toBe(3)

      // Clear attempts (simulating successful login)
      await clearFailedAttempts(testEmail)

      // Verify attempts cleared
      count = await getFailedAttemptCount(testEmail)
      expect(count).toBe(0)
    })

    it('should allow login attempts after clearing', async () => {
      // Add 3 failures
      for (let i = 0; i < 3; i++) {
        await recordFailedAttempt(testEmail)
      }

      // Clear attempts
      await clearFailedAttempts(testEmail)

      // Verify account is not locked and has full attempts remaining
      const lockStatus = await isAccountLocked(testEmail)
      expect(lockStatus.locked).toBe(false)
      expect(lockStatus.attemptsRemaining).toBe(5) // Default maxAttempts
    })
  })

  // =============================================================================
  // Custom Configuration
  // =============================================================================

  describe('Custom Configuration', () => {
    it('should respect custom maxAttempts configuration', async () => {
      const testConfig: BruteForceConfig = {
        maxAttempts: 3,
        lockDurationMs: 30 * 60 * 1000,
        windowMs: 15 * 60 * 1000,
      }

      // Add 3 failures (should lock with custom config)
      for (let i = 0; i < 3; i++) {
        await recordFailedAttempt(testEmail, testConfig)
      }

      // Verify account is locked after 3 attempts
      const lockStatus = await isAccountLocked(testEmail, testConfig)
      expect(lockStatus.locked).toBe(true)
      expect(lockStatus.attemptsRemaining).toBe(0)
    })

    it('should respect custom lockDurationMs configuration', async () => {
      const testConfig: BruteForceConfig = {
        maxAttempts: 3,
        lockDurationMs: 60000, // 1 minute
        windowMs: 15 * 60 * 1000,
      }

      // Lock the account
      for (let i = 0; i < 3; i++) {
        await recordFailedAttempt(testEmail, testConfig)
      }

      // Verify lockUntil is approximately 1 minute in the future
      const lockStatus = await isAccountLocked(testEmail, testConfig)
      expect(lockStatus.locked).toBe(true)

      const now = Date.now()
      const lockUntil = lockStatus.lockUntil!
      const lockDuration = lockUntil - now
      const oneMinute = 60000
      expect(lockDuration).toBeGreaterThan(oneMinute - 5000) // Within 5 seconds
      expect(lockDuration).toBeLessThan(oneMinute + 5000)
    })
  })
})
