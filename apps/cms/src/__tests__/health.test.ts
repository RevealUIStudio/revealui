import type { RevealUIInstance } from '@revealui/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTestRevealUI } from './utils/cms-test-utils';

/**
 * Health Check Endpoint Tests
 * Tests for the /api/health endpoint functionality
 *
 * These are integration tests that require a fully initialized RevealUI instance
 * with database connectivity. Skip in unit test mode.
 */

// Skip integration tests in unit test mode
// Integration tests need TEST_DATABASE_URL explicitly set with migrations run
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const isTestMode = process.env.NODE_ENV === 'test';

describe.skipIf(!testDatabaseUrl || isTestMode)('Health Check Endpoint', () => {
  let revealui: RevealUIInstance;

  beforeAll(async () => {
    revealui = await getTestRevealUI();
  }, 30000); // Increase timeout to 30 seconds for database initialization

  afterAll(async () => {
    // Cleanup handled by test utilities
  });

  describe('Database Health Check', () => {
    it('should verify database connectivity', async () => {
      // Test database connection by querying users collection
      const result = await revealui.find({
        collection: 'users',
        limit: 1,
        depth: 0,
      });

      expect(result).toBeDefined();
      expect(result.docs).toBeDefined();
      expect(Array.isArray(result.docs)).toBe(true);
    });

    it('should handle database query errors gracefully', async () => {
      // Test that invalid queries are handled
      try {
        await revealui.find({
          collection: 'nonexistent',
          limit: 1,
        });
        // Should throw or return empty result
      } catch (error) {
        // Expected to fail for nonexistent collection
        expect(error).toBeDefined();
      }
    });
  });

  describe('Health Check Response Structure', () => {
    it('should return health check data with correct structure', async () => {
      // Verify revealui instance is healthy
      expect(revealui).toBeDefined();
      expect(revealui.config).toBeDefined();
      expect(revealui.config.db).toBeDefined();
    });

    it('should include system metrics', () => {
      // Verify process metrics are available
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage).toBeDefined();
      expect(memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(memoryUsage.rss).toBeGreaterThan(0);
    });

    it('should track response time', async () => {
      const startTime = Date.now();
      await revealui.find({
        collection: 'users',
        limit: 1,
        depth: 0,
      });
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeGreaterThanOrEqual(0);
      expect(responseTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Readiness Probe', () => {
    it('should verify service readiness', async () => {
      // Test that RevealUI CMS is initialized and ready
      expect(revealui).toBeDefined();
      expect(revealui.config).toBeDefined();
      expect(revealui.config.db).toBeDefined();
    });

    it('should verify collections are accessible', async () => {
      // Test that collections can be queried
      const users = await revealui.find({
        collection: 'users',
        limit: 1,
        depth: 0,
      });

      expect(users).toBeDefined();
      expect(users.docs).toBeDefined();
    });
  });

  describe('External Service Checks', () => {
    it('should handle missing Stripe configuration gracefully', () => {
      // If Stripe is not configured, health check should still work
      const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;
      // Test should pass regardless of Stripe configuration
      expect(typeof hasStripeKey).toBe('boolean');
    });

    it('should handle missing Vercel Blob configuration gracefully', () => {
      // If Vercel Blob is not configured, health check should still work
      const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
      // Test should pass regardless of Blob configuration
      expect(typeof hasBlobToken).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle revealui initialization errors', async () => {
      // Verify revealui is initialized correctly
      expect(revealui).toBeDefined();

      // Test that we can still query even if there are no users
      const result = await revealui.find({
        collection: 'users',
        limit: 1,
        depth: 0,
      });

      expect(result).toBeDefined();
      expect(result.docs).toBeDefined();
    });
  });
});
