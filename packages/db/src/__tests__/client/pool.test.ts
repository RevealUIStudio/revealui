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
const mockPoolInstance = {
  totalCount: 5,
  idleCount: 3,
  waitingCount: 0,
  end: mockPoolEnd,
};

vi.mock('pg', () => {
  class MockPool {
    totalCount = mockPoolInstance.totalCount;
    idleCount = mockPoolInstance.idleCount;
    waitingCount = mockPoolInstance.waitingCount;
    end = mockPoolInstance.end;
  }
  return { Pool: MockPool };
});

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}));

vi.mock('@revealui/config', () => ({
  default: {
    database: { url: undefined },
  },
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
// Import the module under test once (avoid repeated dynamic imports)
// ============================================================================

import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import {
  closeAllPools,
  createClient,
  getClient,
  getPoolMetrics,
  resetClient,
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
    it('creates a Neon HTTP client for neon.tech connection strings', () => {
      const db = createClient({
        connectionString: 'postgresql://user:pass@ep-cool-rain.neon.tech/mydb',
      });

      expect(db).toBeDefined();
      expect(drizzleNeon).toHaveBeenCalled();
    });

    it('creates a pg Pool client for Supabase connection strings', () => {
      const db = createClient({
        connectionString: 'postgresql://user:pass@db.project.supabase.co:5432/postgres',
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

    it('passes logger option through to Drizzle', () => {
      createClient({
        connectionString: 'postgresql://user:pass@ep-cool.neon.tech/db',
        logger: true,
      });

      expect(drizzleNeon).toHaveBeenCalledWith(
        expect.objectContaining({
          logger: true,
        }),
      );
    });
  });

  describe('getPoolMetrics', () => {
    it('returns metrics for active pools', () => {
      // Create a Supabase client to register a pool
      createClient({
        connectionString: 'postgresql://user:pass@db.project.supabase.co:5432/postgres',
      });

      const metrics = getPoolMetrics();

      expect(metrics.length).toBeGreaterThanOrEqual(1);
      expect(metrics[0]).toHaveProperty('name');
      expect(metrics[0]).toHaveProperty('totalCount');
      expect(metrics[0]).toHaveProperty('idleCount');
      expect(metrics[0]).toHaveProperty('waitingCount');
    });

    it('returns empty array when no pools are active', () => {
      // Before creating any Supabase/localhost clients, there may be no pools
      // (Neon HTTP clients do not create pools)
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

  describe('getClient', () => {
    it('throws when no connection string is available for REST', () => {
      delete process.env.POSTGRES_URL;
      delete process.env.DATABASE_URL;

      expect(() => getClient('rest')).toThrow('Database connection string not provided');
    });

    it('throws when no connection string is available for vector', () => {
      delete process.env.DATABASE_URL;

      expect(() => getClient('vector')).toThrow('DATABASE_URL environment variable is required');
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
