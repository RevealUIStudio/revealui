/**
 * Database Pool Tests
 *
 * Tests for the optimized database connection pool module.
 * Mocks the pg Pool class and @revealui/utils dependencies.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mocks  -  must be defined before imports (Vitest hoists vi.mock)
// ============================================================================

const mockPoolInstance = {
  on: vi.fn(),
  connect: vi.fn(),
  end: vi.fn(),
  query: vi.fn(),
  totalCount: 10,
  idleCount: 5,
  waitingCount: 0,
};

vi.mock('pg', () => {
  class MockPool {
    on = mockPoolInstance.on;
    connect = mockPoolInstance.connect;
    end = mockPoolInstance.end;
    query = mockPoolInstance.query;
    totalCount = mockPoolInstance.totalCount;
    idleCount = mockPoolInstance.idleCount;
    waitingCount = mockPoolInstance.waitingCount;
  }
  return { Pool: MockPool };
});

vi.mock('@revealui/utils/database', () => ({
  getSSLConfig: vi.fn(() => false),
}));

vi.mock('@revealui/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================================
// Test Helpers
// ============================================================================

/** Store original env and restore after each test */
let originalEnv: NodeJS.ProcessEnv;

function setEnv(overrides: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('pool module', () => {
  beforeEach(() => {
    originalEnv = { ...process.env };
    // Ensure we're not in production for most tests
    process.env.NODE_ENV = 'test';
    vi.clearAllMocks();

    // Reset pool mock stats
    mockPoolInstance.totalCount = 10;
    mockPoolInstance.idleCount = 5;
    mockPoolInstance.waitingCount = 0;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  describe('checkDatabaseHealth', () => {
    it('returns healthy=true when connection succeeds', async () => {
      const mockClient = { query: vi.fn().mockResolvedValue({}), release: vi.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);

      const { checkDatabaseHealth } = await import('../pool.js');
      const result = await checkDatabaseHealth();

      expect(result.healthy).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('returns pool stats when healthy', async () => {
      const mockClient = { query: vi.fn().mockResolvedValue({}), release: vi.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);

      const { checkDatabaseHealth } = await import('../pool.js');
      const result = await checkDatabaseHealth();

      expect(result.stats).toEqual({
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
      });
    });

    it('returns healthy=false when connection fails', async () => {
      mockPoolInstance.connect.mockRejectedValue(new Error('Connection refused'));

      const { checkDatabaseHealth } = await import('../pool.js');
      const result = await checkDatabaseHealth();

      expect(result.healthy).toBe(false);
    });

    it('still returns stats when unhealthy', async () => {
      mockPoolInstance.connect.mockRejectedValue(new Error('timeout'));

      const { checkDatabaseHealth } = await import('../pool.js');
      const result = await checkDatabaseHealth();

      expect(result.stats).toEqual({
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
      });
    });

    it('returns healthy=false when query fails', async () => {
      const mockClient = {
        query: vi.fn().mockRejectedValue(new Error('query failed')),
        release: vi.fn(),
      };
      mockPoolInstance.connect.mockResolvedValue(mockClient);

      const { checkDatabaseHealth } = await import('../pool.js');
      const result = await checkDatabaseHealth();

      expect(result.healthy).toBe(false);
    });
  });

  describe('getPoolStats', () => {
    it('returns current pool statistics', async () => {
      const { getPoolStats } = await import('../pool.js');
      const stats = getPoolStats();

      expect(stats.totalCount).toBe(10);
      expect(stats.idleCount).toBe(5);
      expect(stats.waitingCount).toBe(0);
    });

    it('includes max and min connection config', async () => {
      const { getPoolStats } = await import('../pool.js');
      const stats = getPoolStats();

      expect(stats.maxConnections).toBeDefined();
      expect(stats.minConnections).toBeDefined();
    });

    it('calculates utilization percentage', async () => {
      mockPoolInstance.totalCount = 16;
      mockPoolInstance.idleCount = 0;

      const { getPoolStats } = await import('../pool.js');
      const stats = getPoolStats();

      // utilization = ((totalCount - idleCount) / max) * 100
      expect(stats.utilization).toBeGreaterThan(0);
    });

    it('returns 0% utilization when all idle', async () => {
      mockPoolInstance.totalCount = 5;
      mockPoolInstance.idleCount = 5;

      const { getPoolStats } = await import('../pool.js');
      const stats = getPoolStats();

      expect(stats.utilization).toBe(0);
    });
  });

  describe('warmupPool', () => {
    it('acquires and releases connections to warm up the pool', async () => {
      const mockClient = { release: vi.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);

      const { warmupPool } = await import('../pool.js');
      await warmupPool();

      // Should have connected multiple times (min pool size)
      expect(mockPoolInstance.connect).toHaveBeenCalled();
      // Should have released all clients
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('throws when connection fails during warmup', async () => {
      mockPoolInstance.connect.mockRejectedValue(new Error('Connection refused'));

      const { warmupPool } = await import('../pool.js');
      await expect(warmupPool()).rejects.toThrow('Connection refused');
    });

    it('releases acquired clients even when a later connection fails', async () => {
      const mockClient = { release: vi.fn() };
      // First call succeeds, second fails
      mockPoolInstance.connect
        .mockResolvedValueOnce(mockClient)
        .mockRejectedValueOnce(new Error('pool exhausted'));

      const { warmupPool } = await import('../pool.js');
      await expect(warmupPool()).rejects.toThrow('pool exhausted');

      // The first acquired client should still be released
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('startPoolMonitoring', () => {
    it('returns an interval handle', async () => {
      const { startPoolMonitoring } = await import('../pool.js');
      const handle = startPoolMonitoring(60000);

      expect(handle).toBeDefined();
      clearInterval(handle);
    });

    it('logs pool stats on each interval tick', async () => {
      vi.useFakeTimers();
      const { logger } = await import('@revealui/utils/logger');
      const { startPoolMonitoring } = await import('../pool.js');

      const handle = startPoolMonitoring(1000);
      vi.advanceTimersByTime(1000);

      expect(logger.info).toHaveBeenCalled();

      clearInterval(handle);
      vi.useRealTimers();
    });

    it('warns when utilization exceeds 80%', async () => {
      vi.useFakeTimers();
      // High utilization: 18 total, 0 idle, max 20 => 90%
      mockPoolInstance.totalCount = 18;
      mockPoolInstance.idleCount = 0;

      const { logger } = await import('@revealui/utils/logger');
      const { startPoolMonitoring } = await import('../pool.js');

      const handle = startPoolMonitoring(1000);
      vi.advanceTimersByTime(1000);

      expect(logger.warn).toHaveBeenCalled();

      clearInterval(handle);
      vi.useRealTimers();
    });

    it('warns when many requests are waiting', async () => {
      vi.useFakeTimers();
      mockPoolInstance.waitingCount = 10;

      const { logger } = await import('@revealui/utils/logger');
      const { startPoolMonitoring } = await import('../pool.js');

      const handle = startPoolMonitoring(1000);
      vi.advanceTimersByTime(1000);

      expect(logger.warn).toHaveBeenCalled();

      clearInterval(handle);
      vi.useRealTimers();
    });
  });

  describe('assertProductionConfig', () => {
    it('throws in production without DATABASE_HOST or URL', async () => {
      setEnv({
        NODE_ENV: 'production',
        DATABASE_HOST: undefined,
        DATABASE_URL: undefined,
        POSTGRES_URL: undefined,
      });
      vi.resetModules();

      // Pool creation is lazy (deferred to first access via getPool()),
      // so importing alone doesn't throw  -  calling getPool() does.
      const { getPool } = await import('../pool.js');
      expect(() => getPool()).toThrow(
        'DATABASE_HOST (or DATABASE_URL / POSTGRES_URL) must be set in production',
      );
    });

    it('does not throw in production when DATABASE_HOST is set', async () => {
      setEnv({
        NODE_ENV: 'production',
        DATABASE_HOST: 'db.example.com',
      });
      vi.resetModules();

      const { getPool } = await import('../pool.js');
      expect(getPool()).toBeDefined();
    });

    it('does not throw in production when DATABASE_URL is set', async () => {
      setEnv({
        NODE_ENV: 'production',
        DATABASE_HOST: undefined,
        DATABASE_URL: 'postgres://localhost/db',
      });
      vi.resetModules();

      const { getPool } = await import('../pool.js');
      expect(getPool()).toBeDefined();
    });

    it('does not throw in development without any database env vars', async () => {
      setEnv({
        NODE_ENV: 'development',
        DATABASE_HOST: undefined,
        DATABASE_URL: undefined,
        POSTGRES_URL: undefined,
      });
      vi.resetModules();

      const { getPool } = await import('../pool.js');
      expect(getPool()).toBeDefined();
    });
  });

  describe('pool event handlers', () => {
    it('registers error, connect, acquire, and remove event handlers', async () => {
      const { getPool } = await import('../pool.js');

      // Pool creation is lazy  -  force initialization by calling getPool
      void getPool().totalCount;

      const eventNames = mockPoolInstance.on.mock.calls.map((call: [string, unknown]) => call[0]);
      expect(eventNames).toContain('error');
      expect(eventNames).toContain('connect');
      expect(eventNames).toContain('acquire');
      expect(eventNames).toContain('remove');
    });
  });
});
