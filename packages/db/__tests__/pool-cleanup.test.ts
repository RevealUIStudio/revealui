/**
 * Database Pool Cleanup Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeAllPools, getPoolMetrics, resetClient } from '../src/client/index';

// Use a localhost URL so isLocalhostConnection returns true and a pg Pool is created.
// Without a pool (Neon HTTP path), pool metrics would always be empty.
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/postgres';

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

    // Get a client (which creates a pool for localhost URLs)
    getClient('rest');

    // Get pool metrics
    const metrics = getPoolMetrics();

    // Should have at least one pool
    expect(metrics.length).toBeGreaterThan(0);
  });

  it('should return pool metrics with correct structure', async () => {
    const { getClient } = await import('../src/client/index');

    // Get a client
    getClient('rest');

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

    // Create a client (which creates a pool for localhost URLs)
    getClient('rest');

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
    const _client1 = getClient('rest');

    // Close all pools
    await closeAllPools();

    // Get client again - should be a new instance
    const client2 = getClient('rest');

    // Note: We can't directly compare instances, but we can verify
    // that we can still get a client after closing
    expect(client2).toBeDefined();
  });
});
