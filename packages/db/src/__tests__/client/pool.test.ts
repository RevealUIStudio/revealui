/**
 * Client Pool Management Tests
 *
 * Tests for pool creation, metrics, cleanup, and the createClient function
 * in packages/db/src/client/index.ts. Uses mock-based testing since PGlite
 * cannot fully simulate pg.Pool lifecycle.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mocks  -  must be defined before imports (Vitest hoists vi.mock)
// ============================================================================

const mockPoolEnd = vi.fn().mockResolvedValue(undefined);
const mockPoolOn = vi.fn();
const mockPoolClientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
const mockPoolClientRelease = vi.fn();
const mockPoolConnect = vi.fn().mockResolvedValue({
  query: mockPoolClientQuery,
  release: mockPoolClientRelease,
});
const mockPoolInstance = {
  totalCount: 5,
  idleCount: 3,
  waitingCount: 0,
  end: mockPoolEnd,
  on: mockPoolOn,
};

vi.mock('pg', () => {
  class MockPool {
    totalCount = mockPoolInstance.totalCount;
    idleCount = mockPoolInstance.idleCount;
    waitingCount = mockPoolInstance.waitingCount;
    end = mockPoolInstance.end;
    on = mockPoolInstance.on;
    connect = mockPoolConnect;
  }
  return { Pool: MockPool };
});

vi.mock('@revealui/config', () => ({
  default: {
    database: { url: undefined },
  },
}));

vi.mock('@revealui/utils/database', () => ({
  getSSLConfig: vi.fn(() => false),
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
// Import the module under test once (avoid repeated dynamic imports)
// ============================================================================

import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import {
  closeAllPools,
  createClient,
  getClient,
  getPoolMetrics,
  getRestPool,
  resetClient,
  withReadOnlyRepeatableRead,
} from '../../client/index.js';

// ============================================================================
// Tests
// ============================================================================

describe('client/index  -  pool management', () => {
  const origPostgres = process.env.POSTGRES_URL;
  const origDb = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPoolEnd.mockResolvedValue(undefined);
    mockPoolInstance.totalCount = 5;
    mockPoolInstance.idleCount = 3;
    mockPoolInstance.waitingCount = 0;
    mockPoolClientQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    mockPoolClientRelease.mockReset();
    mockPoolConnect.mockReset().mockResolvedValue({
      query: mockPoolClientQuery,
      release: mockPoolClientRelease,
    });
    resetClient();
  });

  afterEach(() => {
    // Restore env vars
    if (origPostgres !== undefined) {
      process.env.POSTGRES_URL = origPostgres;
    } else {
      delete process.env.POSTGRES_URL;
    }
    if (origDb !== undefined) {
      process.env.DATABASE_URL = origDb;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  describe('createClient', () => {
    it('creates an interactive PostgreSQL client for neon.tech connection strings', () => {
      const db = createClient({
        connectionString: 'postgresql://user:pass@ep-cool-rain.neon.tech/mydb',
      });

      expect(db).toBeDefined();
      expect(drizzlePg).toHaveBeenCalled();
    });

    it('uses the PostgreSQL wire client for cloud Neon connection strings', () => {
      const db = createClient({
        connectionString: 'postgresql://user:pass@ep-cool.neon.tech/neondb',
      });

      expect(db).toBeDefined();
      expect(drizzlePg).toHaveBeenCalled();
    });

    it('creates a pg Pool client for localhost connection strings', () => {
      const db = createClient({
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      expect(db).toBeDefined();
      expect(drizzlePg).toHaveBeenCalled();
    });

    it('creates a pg Pool client for 127.0.0.1 connection strings', () => {
      const db = createClient({
        connectionString: 'postgresql://user:pass@127.0.0.1:5432/testdb',
      });

      expect(db).toBeDefined();
    });

    it("registers an 'error' handler on the pg Pool to prevent idle-client crashes", () => {
      createClient({
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      // pg Pool is an EventEmitter; an unhandled 'error' event (e.g. a dropped idle
      // connection) would otherwise crash the process. See onClientPoolError.
      expect(mockPoolOn).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('passes logger option through to Drizzle', () => {
      createClient({
        connectionString: 'postgresql://user:pass@ep-cool.neon.tech/db',
        logger: true,
      });

      expect(drizzlePg).toHaveBeenCalledWith(
        expect.objectContaining({
          logger: true,
        }),
      );
    });
  });

  describe('getPoolMetrics', () => {
    it('returns metrics for active pools', () => {
      // Create a localhost client to register a pool (only localhost uses pg Pool)
      createClient({
        connectionString: 'postgresql://user:pass@localhost:5432/postgres',
      });

      const metrics = getPoolMetrics();

      expect(metrics.length).toBeGreaterThanOrEqual(1);
      expect(metrics[0]).toHaveProperty('name');
      expect(metrics[0]).toHaveProperty('totalCount');
      expect(metrics[0]).toHaveProperty('idleCount');
      expect(metrics[0]).toHaveProperty('waitingCount');
    });

    it('returns empty array when no pools are active', () => {
      // Before creating any localhost clients, there may be no pools
      // Neon and self-hosted clients both use PostgreSQL pools in the Node runtime.
      const metrics = getPoolMetrics();
      expect(Array.isArray(metrics)).toBe(true);
    });
  });

  describe('closeAllPools', () => {
    it('calls end() on all active pools', async () => {
      // Create a pool-based client
      createClient({
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await closeAllPools();

      expect(mockPoolEnd).toHaveBeenCalled();
    });

    it('resets global clients after closing pools', async () => {
      createClient({
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await closeAllPools();

      const metrics = getPoolMetrics();
      expect(metrics).toHaveLength(0);
    });

    it('handles pool.end() errors gracefully', async () => {
      mockPoolEnd.mockRejectedValue(new Error('pool already closed'));

      createClient({
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      // Should not throw despite pool.end() failure
      await expect(closeAllPools()).resolves.toBeUndefined();
    });
  });

  describe('resetClient', () => {
    it('clears singleton client references', () => {
      // Should not throw
      resetClient();
    });
  });

  describe('withReadOnlyRepeatableRead', () => {
    it('uses one checked-out pool client with repeatable-read and read-only settings', async () => {
      process.env.POSTGRES_URL = 'postgresql://rest-db';
      const result = await withReadOnlyRepeatableRead(async () => 'snapshot');

      expect(result).toBe('snapshot');
      expect(mockPoolConnect).toHaveBeenCalledOnce();
      expect(mockPoolClientQuery.mock.calls.map(([query]) => query)).toEqual([
        'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
        'COMMIT',
      ]);
      expect(mockPoolClientRelease).toHaveBeenCalledOnce();
    });

    it('rolls back callback failures and always releases the connection', async () => {
      process.env.POSTGRES_URL = 'postgresql://rest-db';
      await expect(
        withReadOnlyRepeatableRead(async () => {
          throw new Error('snapshot read failed');
        }),
      ).rejects.toThrow('snapshot read failed');

      expect(mockPoolClientQuery.mock.calls.map(([query]) => query)).toEqual([
        'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
        'ROLLBACK',
      ]);
      expect(mockPoolClientRelease).toHaveBeenCalledOnce();
    });

    it('releases the connection when BEGIN fails', async () => {
      process.env.POSTGRES_URL = 'postgresql://rest-db';
      mockPoolClientQuery.mockRejectedValueOnce(new Error('begin failed'));
      const callback = vi.fn(async () => 'unreachable');

      await expect(withReadOnlyRepeatableRead(callback)).rejects.toThrow('begin failed');

      expect(callback).not.toHaveBeenCalled();
      expect(mockPoolClientQuery.mock.calls.map(([query]) => query)).toEqual([
        'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
        'ROLLBACK',
      ]);
      expect(mockPoolClientRelease).toHaveBeenCalledOnce();
    });

    it('rolls back after COMMIT fails and releases the connection', async () => {
      process.env.POSTGRES_URL = 'postgresql://rest-db';
      mockPoolClientQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockRejectedValueOnce(new Error('commit failed'));

      await expect(withReadOnlyRepeatableRead(async () => 'done')).rejects.toThrow('commit failed');

      expect(mockPoolClientQuery.mock.calls.map(([query]) => query)).toEqual([
        'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
        'COMMIT',
        'ROLLBACK',
      ]);
      expect(mockPoolClientRelease).toHaveBeenCalledOnce();
    });
  });

  describe('getClient', () => {
    it('shares the PostgreSQL wire pool for cloud Neon clients', () => {
      process.env.POSTGRES_URL = 'postgresql://user:pass@ep-test.neon.tech/db';
      getClient('rest');
      const pool = getRestPool();

      expect(pool).not.toBeNull();
      expect(drizzlePg).toHaveBeenCalledWith(expect.objectContaining({ client: pool }));
    });

    it('throws when no connection string is available for REST', () => {
      delete process.env.POSTGRES_URL;
      delete process.env.DATABASE_URL;

      expect(() => getClient('rest')).toThrow('Database connection string not provided');
    });

    it('falls back to rest for the removed "vector" alias (throws with no connection string)', () => {
      delete process.env.POSTGRES_URL;
      delete process.env.DATABASE_URL;

      // 'vector' is no longer a recognized DatabaseType (removed in #1643); it falls
      // through to the default 'rest' client, which throws when no connection string
      // is set.
      expect(() => getClient('vector')).toThrow('Database connection string not provided');
    });

    it('defaults to rest when called without arguments', () => {
      process.env.POSTGRES_URL = 'postgresql://user:pass@ep-test.neon.tech/db';

      const db = getClient();
      expect(db).toBeDefined();
    });

    it('accepts a legacy connection string argument', () => {
      const db = getClient('postgresql://user:pass@ep-test.neon.tech/db');
      expect(db).toBeDefined();
    });

    it('returns the same instance on subsequent calls (singleton)', () => {
      process.env.POSTGRES_URL = 'postgresql://user:pass@ep-test.neon.tech/db';

      const db1 = getClient('rest');
      const db2 = getClient('rest');
      expect(db1).toBe(db2);
    });
  });
});
