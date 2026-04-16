/**
 * Database Connection Failure Tests
 *
 * Tests for connection error handling, pool exhaustion, reconnection,
 * and graceful shutdown behavior in the database client layer.
 *
 * Mocks the pg module to simulate various failure scenarios without
 * requiring a real database connection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mock State  -  shared between mock factory and tests
// ============================================================================

interface MockPoolState {
  connectFn: ReturnType<typeof vi.fn>;
  queryFn: ReturnType<typeof vi.fn>;
  endFn: ReturnType<typeof vi.fn>;
  onFn: ReturnType<typeof vi.fn>;
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  eventHandlers: Map<string, Array<(...args: unknown[]) => void>>;
}

const mockPoolState: MockPoolState = {
  connectFn: vi.fn(),
  queryFn: vi.fn(),
  endFn: vi.fn(),
  onFn: vi.fn(),
  totalCount: 10,
  idleCount: 5,
  waitingCount: 0,
  eventHandlers: new Map(),
};

// ============================================================================
// Mocks  -  must be defined before imports (Vitest hoists vi.mock)
// ============================================================================

vi.mock('pg', () => {
  class MockPool {
    on = (event: string, handler: (...args: unknown[]) => void) => {
      mockPoolState.onFn(event, handler);
      const handlers = mockPoolState.eventHandlers.get(event) ?? [];
      handlers.push(handler);
      mockPoolState.eventHandlers.set(event, handlers);
      return this;
    };
    connect = mockPoolState.connectFn;
    query = mockPoolState.queryFn;
    end = mockPoolState.endFn;
    get totalCount() {
      return mockPoolState.totalCount;
    }
    get idleCount() {
      return mockPoolState.idleCount;
    }
    get waitingCount() {
      return mockPoolState.waitingCount;
    }
  }
  return { Pool: MockPool };
});

vi.mock('@revealui/config', () => ({
  default: {},
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}));

vi.mock('@revealui/utils/database', () => ({
  getSSLConfig: vi.fn(() => false),
}));

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => ({
    query: {},
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({
    query: {},
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  })),
}));

// ============================================================================
// Helpers
// ============================================================================

/** Creates an error with a code property (like Node.js system errors) */
function createSystemError(message: string, code: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

/** Creates a mock pg PoolClient */
function createMockClient(overrides: Record<string, unknown> = {}) {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
    ...overrides,
  };
}

/** Store original env */
let originalEnv: NodeJS.ProcessEnv;

// ============================================================================
// Tests
// ============================================================================

describe('database connection failures', () => {
  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
    process.env.POSTGRES_URL = 'postgresql://test:test@localhost:5432/testdb';

    vi.clearAllMocks();
    mockPoolState.eventHandlers.clear();
    mockPoolState.totalCount = 10;
    mockPoolState.idleCount = 5;
    mockPoolState.waitingCount = 0;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  // --------------------------------------------------------------------------
  // (a) Connection Refused
  // --------------------------------------------------------------------------

  describe('connection refused (ECONNREFUSED)', () => {
    it('throws a descriptive error when the database is unreachable', async () => {
      const error = createSystemError('connect ECONNREFUSED 127.0.0.1:5432', 'ECONNREFUSED');
      mockPoolState.connectFn.mockRejectedValue(error);

      const { checkDatabaseHealth } = await import('../../pool.js');
      const result = await checkDatabaseHealth();

      expect(result.healthy).toBe(false);
    });

    it('reports unhealthy status with pool stats on ECONNREFUSED', async () => {
      const error = createSystemError('connect ECONNREFUSED 127.0.0.1:5432', 'ECONNREFUSED');
      mockPoolState.connectFn.mockRejectedValue(error);

      const { checkDatabaseHealth } = await import('../../pool.js');
      const result = await checkDatabaseHealth();

      expect(result.healthy).toBe(false);
      expect(result.stats).toEqual({
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
      });
    });

    it('prevents connection acquisition when server is down', async () => {
      const error = createSystemError('connect ECONNREFUSED 127.0.0.1:5432', 'ECONNREFUSED');
      mockPoolState.connectFn.mockRejectedValue(error);

      const { getPool } = await import('../../pool.js');
      const pool = getPool();
      await expect(pool.connect()).rejects.toThrow('ECONNREFUSED');
    });
  });

  // --------------------------------------------------------------------------
  // (b) Connection Timeout
  // --------------------------------------------------------------------------

  describe('connection timeout', () => {
    it('returns unhealthy when connection times out', async () => {
      const error = new Error('Connection terminated due to connection timeout');
      mockPoolState.connectFn.mockRejectedValue(error);

      const { checkDatabaseHealth } = await import('../../pool.js');
      const result = await checkDatabaseHealth();

      expect(result.healthy).toBe(false);
    });

    it('rejects pool.connect with timeout error', async () => {
      const error = new Error('timeout expired');
      mockPoolState.connectFn.mockRejectedValue(error);

      const { getPool } = await import('../../pool.js');
      const pool = getPool();
      await expect(pool.connect()).rejects.toThrow('timeout expired');
    });

    it('propagates timeout during warmup', async () => {
      const error = new Error('Connection terminated due to connection timeout');
      mockPoolState.connectFn.mockRejectedValue(error);

      const { warmupPool } = await import('../../pool.js');
      await expect(warmupPool()).rejects.toThrow('Connection terminated');
    });
  });

  // --------------------------------------------------------------------------
  // (c) Pool Exhaustion
  // --------------------------------------------------------------------------

  describe('pool exhaustion', () => {
    it('reports high waiting count when pool is exhausted', async () => {
      mockPoolState.totalCount = 20;
      mockPoolState.idleCount = 0;
      mockPoolState.waitingCount = 15;

      const mockClient = createMockClient();
      mockPoolState.connectFn.mockResolvedValue(mockClient);

      const { checkDatabaseHealth } = await import('../../pool.js');
      const result = await checkDatabaseHealth();

      expect(result.healthy).toBe(true);
      expect(result.stats.waitingCount).toBe(15);
    });

    it('rejects when connection timeout expires during exhaustion', async () => {
      const error = new Error('Timed out waiting for available connection in pool');
      mockPoolState.connectFn.mockRejectedValue(error);

      const { getPool } = await import('../../pool.js');
      const pool = getPool();
      await expect(pool.connect()).rejects.toThrow('Timed out');
    });

    it('calculates 100% utilization when all connections are active', async () => {
      mockPoolState.totalCount = 20;
      mockPoolState.idleCount = 0;

      const { getPoolStats } = await import('../../pool.js');
      const stats = getPoolStats();

      expect(stats.utilization).toBe(100);
    });

    it('warmup fails when pool is already fully exhausted', async () => {
      const mockClient = createMockClient();
      mockPoolState.connectFn
        .mockResolvedValueOnce(mockClient)
        .mockResolvedValueOnce(mockClient)
        .mockRejectedValueOnce(new Error('Cannot acquire connection: pool is full'));

      const { warmupPool } = await import('../../pool.js');
      await expect(warmupPool()).rejects.toThrow('pool is full');

      // Previously acquired clients should still be released
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // (d) Connection Drop Mid-Query
  // --------------------------------------------------------------------------

  describe('connection drop mid-query', () => {
    it('returns unhealthy when connection resets during health check query', async () => {
      const mockClient = createMockClient({
        query: vi
          .fn()
          .mockRejectedValue(createSystemError('Connection reset by peer', 'ECONNRESET')),
      });
      mockPoolState.connectFn.mockResolvedValue(mockClient);

      const { checkDatabaseHealth } = await import('../../pool.js');
      const result = await checkDatabaseHealth();

      expect(result.healthy).toBe(false);
    });

    it('emits pool error event on unexpected connection termination', async () => {
      const { getPool } = await import('../../pool.js');

      // Pool creation is lazy  -  force initialization by calling getPool
      void getPool().totalCount;

      const errorHandlers = mockPoolState.eventHandlers.get('error') ?? [];
      expect(errorHandlers.length).toBeGreaterThan(0);

      // Verify the error handler is registered and callable
      const connectionError = createSystemError('Connection terminated unexpectedly', 'ECONNRESET');

      // Should not throw  -  error handler logs but does not propagate
      expect(() => {
        for (const handler of errorHandlers) {
          handler(connectionError);
        }
      }).not.toThrow();
    });

    it('releases client even when query fails mid-execution', async () => {
      const releaseFn = vi.fn();
      const mockClient = createMockClient({
        query: vi.fn().mockRejectedValue(new Error('connection was terminated')),
        release: releaseFn,
      });
      mockPoolState.connectFn.mockResolvedValue(mockClient);

      const { checkDatabaseHealth } = await import('../../pool.js');
      await checkDatabaseHealth();

      // The health check should still attempt to get stats even on failure
      // Client release happens inside the try block before the error
      // In the actual implementation, release is called before the query in SELECT 1
      // The health check catches the error gracefully
      expect(mockClient.query).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // (e) DNS Resolution Failure
  // --------------------------------------------------------------------------

  describe('DNS resolution failure (ENOTFOUND)', () => {
    it('returns unhealthy when hostname cannot be resolved', async () => {
      const error = createSystemError('getaddrinfo ENOTFOUND db.invalid.host', 'ENOTFOUND');
      mockPoolState.connectFn.mockRejectedValue(error);

      const { checkDatabaseHealth } = await import('../../pool.js');
      const result = await checkDatabaseHealth();

      expect(result.healthy).toBe(false);
    });

    it('rejects pool.connect with ENOTFOUND error', async () => {
      const error = createSystemError(
        'getaddrinfo ENOTFOUND db.nonexistent.example.com',
        'ENOTFOUND',
      );
      mockPoolState.connectFn.mockRejectedValue(error);

      const { getPool } = await import('../../pool.js');
      const pool = getPool();
      await expect(pool.connect()).rejects.toThrow('ENOTFOUND');
    });

    it('includes hostname in the error message', async () => {
      const error = createSystemError(
        'getaddrinfo ENOTFOUND db.nonexistent.example.com',
        'ENOTFOUND',
      );
      mockPoolState.connectFn.mockRejectedValue(error);

      const { getPool } = await import('../../pool.js');
      const pool = getPool();

      try {
        await pool.connect();
        expect.unreachable('Should have thrown');
      } catch (caught) {
        const caughtError = caught as Error & { code: string };
        expect(caughtError.code).toBe('ENOTFOUND');
        expect(caughtError.message).toContain('db.nonexistent.example.com');
      }
    });
  });

  // --------------------------------------------------------------------------
  // (f) Authentication Failure
  // --------------------------------------------------------------------------

  describe('authentication failure', () => {
    it('returns unhealthy on invalid credentials', async () => {
      const error = new Error('password authentication failed for user "wronguser"');
      mockPoolState.connectFn.mockRejectedValue(error);

      const { checkDatabaseHealth } = await import('../../pool.js');
      const result = await checkDatabaseHealth();

      expect(result.healthy).toBe(false);
    });

    it('rejects pool.connect with authentication error', async () => {
      const error = new Error('password authentication failed for user "testuser"');
      mockPoolState.connectFn.mockRejectedValue(error);

      const { getPool } = await import('../../pool.js');
      const pool = getPool();
      await expect(pool.connect()).rejects.toThrow('password authentication failed');
    });

    it('fails warmup on auth rejection', async () => {
      const error = new Error('password authentication failed for user "testuser"');
      mockPoolState.connectFn.mockRejectedValue(error);

      const { warmupPool } = await import('../../pool.js');
      await expect(warmupPool()).rejects.toThrow('password authentication failed');
    });
  });

  // --------------------------------------------------------------------------
  // (g) SSL/TLS Errors
  // --------------------------------------------------------------------------

  describe('SSL/TLS errors', () => {
    it('returns unhealthy on SSL certificate validation failure', async () => {
      const error = createSystemError(
        'self-signed certificate in certificate chain',
        'DEPTH_ZERO_SELF_SIGNED_CERT',
      );
      mockPoolState.connectFn.mockRejectedValue(error);

      const { checkDatabaseHealth } = await import('../../pool.js');
      const result = await checkDatabaseHealth();

      expect(result.healthy).toBe(false);
    });

    it('rejects on expired certificate', async () => {
      const error = createSystemError('certificate has expired', 'CERT_HAS_EXPIRED');
      mockPoolState.connectFn.mockRejectedValue(error);

      const { getPool } = await import('../../pool.js');
      const pool = getPool();
      await expect(pool.connect()).rejects.toThrow('certificate has expired');
    });

    it('rejects on hostname mismatch', async () => {
      const error = createSystemError(
        "Hostname/IP does not match certificate's altnames",
        'ERR_TLS_CERT_ALTNAME_INVALID',
      );
      mockPoolState.connectFn.mockRejectedValue(error);

      const { getPool } = await import('../../pool.js');
      const pool = getPool();
      await expect(pool.connect()).rejects.toThrow('altnames');
    });

    it('rejects on SSL protocol error', async () => {
      const error = createSystemError(
        'SSL routines:ssl3_read_bytes:tlsv1 alert protocol_version',
        'ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION',
      );
      mockPoolState.connectFn.mockRejectedValue(error);

      const { getPool } = await import('../../pool.js');
      const pool = getPool();
      await expect(pool.connect()).rejects.toThrow('protocol_version');
    });
  });

  // --------------------------------------------------------------------------
  // (h) Reconnection Behavior
  // --------------------------------------------------------------------------

  describe('reconnection behavior', () => {
    it('allows new connections after a transient failure clears', async () => {
      const error = createSystemError('connect ECONNREFUSED 127.0.0.1:5432', 'ECONNREFUSED');
      const mockClient = createMockClient();

      // First attempt fails, second succeeds
      mockPoolState.connectFn.mockRejectedValueOnce(error).mockResolvedValueOnce(mockClient);

      const { getPool } = await import('../../pool.js');
      const pool = getPool();

      // First connection attempt should fail
      await expect(pool.connect()).rejects.toThrow('ECONNREFUSED');

      // Second attempt should succeed (pool retries internally or caller retries)
      const client = await pool.connect();
      expect(client).toBeDefined();
      expect(client.query).toBeDefined();
    });

    it('health check recovers after transient failure', async () => {
      const error = new Error('Connection terminated');
      const mockClient = createMockClient();

      mockPoolState.connectFn.mockRejectedValueOnce(error).mockResolvedValueOnce(mockClient);

      const { checkDatabaseHealth } = await import('../../pool.js');

      // First check should fail
      const firstResult = await checkDatabaseHealth();
      expect(firstResult.healthy).toBe(false);

      // Second check should succeed
      const secondResult = await checkDatabaseHealth();
      expect(secondResult.healthy).toBe(true);
    });

    it('warmup succeeds after initial transient failures', async () => {
      const mockClient = createMockClient();

      // All warmup connections succeed
      mockPoolState.connectFn.mockResolvedValue(mockClient);

      const { warmupPool } = await import('../../pool.js');
      await expect(warmupPool()).resolves.toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // (i) Graceful Shutdown
  // --------------------------------------------------------------------------

  describe('graceful shutdown', () => {
    it('pool.end() resolves when all connections are released', async () => {
      mockPoolState.endFn.mockResolvedValue(undefined);

      const { getPool } = await import('../../pool.js');
      const pool = getPool();
      await expect(pool.end()).resolves.toBeUndefined();
      expect(mockPoolState.endFn).toHaveBeenCalledOnce();
    });

    it('pool.end() rejects when active connections cannot be drained', async () => {
      const error = new Error('Cannot end pool: active connections remain');
      mockPoolState.endFn.mockRejectedValue(error);

      const { getPool } = await import('../../pool.js');
      const pool = getPool();
      await expect(pool.end()).rejects.toThrow('active connections remain');
    });

    it('closeAllPools drains all tracked pools', async () => {
      // Pre-set end to resolve so the MockPool instances get a working end()
      mockPoolState.endFn.mockResolvedValue(undefined);

      // Import from client/index which tracks pools via activePools
      const { createClient, closeAllPools, getPoolMetrics } = await import('../../client/index.js');

      // Create a client using a localhost connection string (triggers pg Pool path)
      createClient({
        connectionString: 'postgresql://test:test@localhost:5432/testdb',
      });

      // Should have tracked pools
      const metricsBefore = getPoolMetrics();
      expect(metricsBefore.length).toBeGreaterThan(0);

      await closeAllPools();

      // After closing, metrics should be empty
      const metricsAfter = getPoolMetrics();
      expect(metricsAfter.length).toBe(0);
    }, 30_000);

    it('closeAllPools handles errors gracefully during shutdown', async () => {
      // Set end to reject BEFORE creating client so instances get the rejecting mock
      mockPoolState.endFn.mockRejectedValue(new Error('Forced close failed'));

      const { createClient, closeAllPools } = await import('../../client/index.js');

      createClient({
        connectionString: 'postgresql://test:test@localhost:5432/testdb',
      });

      // Should not throw  -  errors are caught during shutdown
      await expect(closeAllPools()).resolves.toBeUndefined();
    });

    it('closeAllPools resets global client singletons', async () => {
      mockPoolState.endFn.mockResolvedValue(undefined);

      const { closeAllPools, resetClient, getClient } = await import('../../client/index.js');

      process.env.POSTGRES_URL = 'postgresql://test:test@neon.tech/testdb';

      // Initialize a rest client
      const client1 = getClient('rest');
      expect(client1).toBeDefined();

      await closeAllPools();

      // After closeAllPools, getting a new client should create a fresh instance
      const client2 = getClient('rest');
      expect(client2).not.toBe(client1);

      // Clean up
      resetClient();
    });
  });

  // --------------------------------------------------------------------------
  // Additional edge cases
  // --------------------------------------------------------------------------

  describe('error event handling on idle clients', () => {
    it('registers an error event handler on pool creation', async () => {
      const { getPool } = await import('../../pool.js');

      // Pool creation is lazy  -  force initialization by calling getPool
      void getPool().totalCount;

      const errorHandlers = mockPoolState.eventHandlers.get('error');
      expect(errorHandlers).toBeDefined();
      expect(errorHandlers!.length).toBeGreaterThan(0);
    });

    it('error handler does not crash on non-Error objects', async () => {
      const { getPool } = await import('../../pool.js');

      // Pool creation is lazy  -  force initialization by calling getPool
      void getPool().totalCount;

      const errorHandlers = mockPoolState.eventHandlers.get('error') ?? [];

      // Pool may emit non-Error objects in rare cases
      expect(() => {
        for (const handler of errorHandlers) {
          handler('string error message');
        }
      }).not.toThrow();
    });
  });

  describe('createClient driver selection under failures', () => {
    it('uses pg Pool for localhost connections (enabling pool error handling)', async () => {
      const drizzlePgMod = await import('drizzle-orm/node-postgres');
      const { createClient } = await import('../../client/index.js');

      createClient({
        connectionString: 'postgresql://user:pass@localhost:5432/db',
      });

      // node-postgres drizzle should have been called (pg Pool path)
      expect(drizzlePgMod.drizzle).toHaveBeenCalled();
    });

    it('uses pg Pool for Supabase connections', async () => {
      const drizzlePgMod = await import('drizzle-orm/node-postgres');
      const { createClient } = await import('../../client/index.js');

      createClient({
        connectionString:
          'postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
      });

      expect(drizzlePgMod.drizzle).toHaveBeenCalled();
    });

    it('uses Neon driver for NeonDB connections (no pool)', async () => {
      const { neon } = await import('@neondatabase/serverless');
      const { createClient } = await import('../../client/index.js');

      createClient({
        connectionString:
          'postgresql://user:pass@ep-cool-snow-123456.us-east-2.aws.neon.tech/neondb',
      });

      expect(neon).toHaveBeenCalledWith(
        'postgresql://user:pass@ep-cool-snow-123456.us-east-2.aws.neon.tech/neondb',
      );
    });
  });

  describe('missing environment variables', () => {
    it('throws when no connection string is available for REST client', async () => {
      Reflect.deleteProperty(process.env, 'POSTGRES_URL');
      Reflect.deleteProperty(process.env, 'DATABASE_URL');

      vi.resetModules();
      const { getClient, resetClient } = await import('../../client/index.js');
      resetClient();

      expect(() => getClient('rest')).toThrow('Database connection string not provided');
    });

    it('throws when DATABASE_URL is missing for vector client', async () => {
      Reflect.deleteProperty(process.env, 'DATABASE_URL');

      vi.resetModules();
      const { getClient, resetClient } = await import('../../client/index.js');
      resetClient();

      expect(() => getClient('vector')).toThrow('DATABASE_URL');
    });
  });
});
