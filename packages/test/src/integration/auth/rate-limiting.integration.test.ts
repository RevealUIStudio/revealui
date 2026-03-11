/**
 * Rate Limiting Integration Tests
 *
 * PURPOSE: Verify rate limiting mechanisms work correctly for authentication endpoints
 *
 * CRITICAL CONTEXT: Rate limiting must work correctly to prevent:
 * - Brute force attacks through rapid login attempts
 * - API abuse and DDoS attacks
 * - Resource exhaustion
 *
 * TESTS:
 * - Rate limit enforcement (default 5 requests in 15 min window)
 * - Blocking after limit exceeded (default 30 min block)
 * - Window reset behavior
 * - Rate limit reset functionality
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkRateLimit,
  getRateLimitStatus,
  resetRateLimit,
} from '../../../../auth/src/server/rate-limit.js';
import { generateUniqueTestEmail } from '../../utils/integration-helpers.js';

// Type for rate limit configuration
interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

describe('Rate Limiting Integration Tests', () => {
  let testKey: string;

  beforeEach(async () => {
    // Generate unique key for each test to prevent interference
    testKey = generateUniqueTestEmail('rate-limit');
    // Clear rate limit before each test
    await resetRateLimit(testKey);
  });

  // =============================================================================
  // Rate Limit Enforcement
  // =============================================================================

  describe('Rate Limit Enforcement', () => {
    it('should allow requests under limit (5 requests in 15 min window)', async () => {
      // Make 4 requests
      const results: Array<{ allowed: boolean; remaining: number }> = [];

      for (let i = 0; i < 4; i++) {
        const result = await checkRateLimit(testKey);
        results.push(result);
      }

      // All should be allowed
      expect(results.every((r) => r.allowed)).toBe(true);

      // Remaining should decrement: 4, 3, 2, 1
      expect(results[0]?.remaining).toBe(4);
      expect(results[1]?.remaining).toBe(3);
      expect(results[2]?.remaining).toBe(2);
      expect(results[3]?.remaining).toBe(1);
    });

    it('should block requests after limit reached', async () => {
      // Make 5 requests (max)
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(testKey);
      }

      // 6th request should be blocked
      const result = await checkRateLimit(testKey);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return correct remaining count', async () => {
      // Initial request
      const result1 = await checkRateLimit(testKey);
      expect(result1.remaining).toBe(4);

      // Second request
      const result2 = await checkRateLimit(testKey);
      expect(result2.remaining).toBe(3);

      // Third request
      const result3 = await checkRateLimit(testKey);
      expect(result3.remaining).toBe(2);
    });

    it('should return correct resetAt timestamp', async () => {
      const beforeTime = Date.now();
      const result = await checkRateLimit(testKey);
      const afterTime = Date.now();

      // resetAt should be windowMs (15 min) from first request
      const fifteenMinutes = 15 * 60 * 1000;
      expect(result.resetAt).toBeGreaterThan(beforeTime + fifteenMinutes - 1000);
      expect(result.resetAt).toBeLessThan(afterTime + fifteenMinutes + 1000);
    });
  });

  // =============================================================================
  // Rate Limit Blocking
  // =============================================================================

  describe('Rate Limit Blocking', () => {
    it('should block for blockDurationMs after limit exceeded', async () => {
      // Use custom config with short durations for testing
      // Note: windowMs must be long enough to not expire during testing,
      // as the implementation deletes entries when resetAt expires
      const testConfig: RateLimitConfig = {
        maxAttempts: 3,
        windowMs: 500, // 500ms window (long enough for our test)
        blockDurationMs: 700, // 700ms total block duration
      };

      // Exceed limit (3 requests)
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(testKey, testConfig);
      }

      // 4th request should be blocked
      const result = await checkRateLimit(testKey, testConfig);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);

      // Wait a bit but not long enough for block to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should still be blocked (within block duration)
      const result2 = await checkRateLimit(testKey, testConfig);
      expect(result2.allowed).toBe(false);

      // Wait for block to expire (total 500ms + 700ms - 500ms = 700ms from start)
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Should now be allowed (block expired)
      const result3 = await checkRateLimit(testKey, testConfig);
      expect(result3.allowed).toBe(true);
    });

    it('should return extended resetAt when blocked', async () => {
      // Use custom config
      const testConfig: RateLimitConfig = {
        maxAttempts: 2,
        windowMs: 1000, // 1 second
        blockDurationMs: 2000, // 2 seconds
      };

      // Exceed limit
      for (let i = 0; i < 2; i++) {
        await checkRateLimit(testKey, testConfig);
      }

      const beforeTime = Date.now();
      const result = await checkRateLimit(testKey, testConfig);
      const afterTime = Date.now();

      // resetAt should include blockDurationMs extension
      expect(result.allowed).toBe(false);
      // The block should be approximately 2 seconds from now
      expect(result.resetAt).toBeGreaterThan(beforeTime + 1000); // At least 1 second
      expect(result.resetAt).toBeLessThan(afterTime + 3000); // Less than 3 seconds
    });
  });

  // =============================================================================
  // Window Reset
  // =============================================================================

  describe('Window Reset', () => {
    it('should reset limit after window expires', async () => {
      // Use custom config with short window
      const testConfig: RateLimitConfig = {
        maxAttempts: 3,
        windowMs: 100, // 100ms
      };

      // Make 2 requests
      await checkRateLimit(testKey, testConfig);
      await checkRateLimit(testKey, testConfig);

      // Verify count
      const status = await getRateLimitStatus(testKey, testConfig);
      expect(status.count).toBe(2);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // New requests should be allowed with full remaining count
      const result = await checkRateLimit(testKey, testConfig);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2); // maxAttempts - 1 (current request)
    });

    it('should reset block after block duration expires', async () => {
      // Use custom config with longer window to avoid window expiration during test
      const testConfig: RateLimitConfig = {
        maxAttempts: 2,
        windowMs: 400, // Long enough window
        blockDurationMs: 600, // Total block duration
      };

      // Trigger block
      for (let i = 0; i < 2; i++) {
        await checkRateLimit(testKey, testConfig);
      }

      // Verify blocked
      let result = await checkRateLimit(testKey, testConfig);
      expect(result.allowed).toBe(false);

      // Wait for block to expire (600ms + 100ms buffer)
      await new Promise((resolve) => setTimeout(resolve, 700));

      // Requests should be allowed again
      result = await checkRateLimit(testKey, testConfig);
      expect(result.allowed).toBe(true);
    });
  });

  // =============================================================================
  // Rate Limit Reset
  // =============================================================================

  describe('Rate Limit Reset', () => {
    it('should reset rate limit via resetRateLimit()', async () => {
      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(testKey);
      }

      // Verify count
      let status = await getRateLimitStatus(testKey);
      expect(status.count).toBe(3);

      // Reset
      await resetRateLimit(testKey);

      // Verify count is 0
      status = await getRateLimitStatus(testKey);
      expect(status.count).toBe(0);
    });

    it('should allow full limit after reset', async () => {
      // Make requests until blocked
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(testKey);
      }

      // Verify blocked
      let result = await checkRateLimit(testKey);
      expect(result.allowed).toBe(false);

      // Reset
      await resetRateLimit(testKey);

      // Verify remaining = maxAttempts
      const status = await getRateLimitStatus(testKey);
      expect(status.remaining).toBe(5); // Default maxAttempts

      // Verify can make new requests
      result = await checkRateLimit(testKey);
      expect(result.allowed).toBe(true);
    });
  });
});
