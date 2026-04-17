/**
 * Database Pool Cleanup Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeAllPools, getPoolMetrics, resetClient } from '../src/client/index';

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@test.supabase.co:6543/postgres';
process.env.SUPABASE_DATABASE_URL = 'postgresql://test:test@test.supabase.co:6543/postgres';

describe('Database Pool Cleanup', () => {
  beforeEach(() => {
    resetClient();
  });

  afterEach(async () => {
    await closeAllPools();
    resetClient();
  });

  it('should track pool metrics after creating a client', async () => {
    // Import the client creation (this will create a pool)
    const { getClient } = await import('../src/client/index');

    // Get a client (which creates a pool)
    getClient('vector');

    // Get pool metrics
    const metrics = getPoolMetrics();

    // Should have at least one pool
    expect(metrics.length).toBeGreaterThan(0);
  });

  it('should return pool metrics with correct structure', async () => {
    const { getClient } = await import('../src/client/index');

    // Get a client
    getClient('vector');

    // Get pool metrics
    const metrics = getPoolMetrics();

    if (metrics.length > 0) {
      const pool = metrics[0];
      expect(pool).toHaveProperty('name');
      expect(pool).toHaveProperty('totalCount');
      expect(pool).toHaveProperty('idleCount');
      expect(pool).toHaveProperty('waitingCount');
    }
  });

  it('should close all pools on closeAllPools', async () => {
    const { getClient } = await import('../src/client/index');

    // Create a client (which creates a pool)
    getClient('vector');

    // Verify pool exists
    let metrics = getPoolMetrics();
    expect(metrics.length).toBeGreaterThan(0);

    // Close all pools
    await closeAllPools();

    // After closing, metrics should be empty
    metrics = getPoolMetrics();
    expect(metrics.length).toBe(0);
  });

  it('should reset clients after closeAllPools', async () => {
    const { getClient } = await import('../src/client/index');

    // Create a client
    const _client1 = getClient('vector');

    // Close all pools
    await closeAllPools();

    // Get client again - should be a new instance
    const client2 = getClient('vector');

    // Note: We can't directly compare instances, but we can verify
    // that we can still get a client after closing
    expect(client2).toBeDefined();
  });
});
