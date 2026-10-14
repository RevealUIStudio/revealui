/**
 * Transaction Handling Tests
 *
 * Tests for the withTransaction helper in packages/db/src/client/index.ts.
 * Since the Neon HTTP driver does not support transactions, these tests verify:
 * - Managed callback transaction transport for owned Neon HTTP clients
 * - Successful delegation to Drizzle's transaction API for pg-based clients
 * - Rollback behavior on error
 */

import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

const mockTransaction = vi.fn();
const mockPoolEnd = vi.fn().mockResolvedValue(undefined);
const mockConnection = { release: vi.fn() };
const mockPoolConnect = vi.fn(async () => mockConnection);

vi.mock('pg', () => {
  class MockPool {
    totalCount = 5;
    idleCount = 3;
    waitingCount = 0;
    end = mockPoolEnd;
    on = vi.fn();
    connect = mockPoolConnect;
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
  drizzle: vi.fn((options: { client: unknown }) => ({
    $client: options.client,
    query: {},
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    // Neon HTTP client does NOT have a transaction method
  })),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn((options: { client: unknown }) => ({
    $client: options.client,
    query: {},
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: mockTransaction,
  })),
}));

// ============================================================================
// Import once to avoid dynamic import timeouts
// ============================================================================

import {
  closeAllPools,
  createClient,
  getClient,
  getPoolMetrics,
  getRestPool,
  getTransactionConnection,
  getTransactionContext,
  resetClient,
  withTransaction,
} from '../../client/index.js';

// ============================================================================
// Tests
// ============================================================================

describe('withTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetClient();
  });

  afterEach(() => {
    resetClient();
  });

  it('uses one maintained pg pool for repeated transactions on a canonical Neon HTTP client', async () => {
    await closeAllPools();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));
    const neonDb = createClient({
      connectionString: 'postgresql://user:pass@ep-cool.neon.tech/mydb',
    });
    expect(getPoolMetrics()).toHaveLength(0);
    expect(await withTransaction(neonDb, async () => 'first')).toBe('first');
    expect(await withTransaction(neonDb, async () => 'second')).toBe('second');
    expect(getPoolMetrics()).toHaveLength(1);
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });

  it('delegates to Drizzle transaction API for pg-based clients', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({ insert: vi.fn(), update: vi.fn() });
    });

    const pgDb = createClient({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
    });

    const result = await withTransaction(pgDb, async (_tx) => {
      return 'committed';
    });

    expect(result).toBe('committed');
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it('propagates errors from the transaction callback', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({ insert: vi.fn() });
    });

    const pgDb = createClient({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
    });

    await expect(
      withTransaction(pgDb, async () => {
        throw new Error('constraint violation');
      }),
    ).rejects.toThrow('constraint violation');
  });

  it('passes the transaction context to the callback', async () => {
    const txContext = { insert: vi.fn(), update: vi.fn(), select: vi.fn() };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(txContext);
    });

    const pgDb = createClient({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
    });

    await withTransaction(pgDb, async (tx) => {
      expect(tx).toBeDefined();
      return 'ok';
    });
  });

  it('returns the value from a successful transaction', async () => {
    const expectedResult = { id: 'user-123', email: 'test@example.com' };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({ insert: vi.fn() });
    });

    const pgDb = createClient({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
    });

    const result = await withTransaction(pgDb, async () => {
      return expectedResult;
    });

    expect(result).toEqual(expectedResult);
  });

  it('Drizzle handles rollback when transaction throws', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return await fn({ insert: vi.fn() });
    });

    const pgDb = createClient({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
    });

    await expect(
      withTransaction(pgDb, async () => {
        throw new Error('rollback me');
      }),
    ).rejects.toThrow('rollback me');
  });

  it('handles async operations inside the transaction', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({ insert: vi.fn(), update: vi.fn() });
    });

    const pgDb = createClient({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
    });

    const result = await withTransaction(pgDb, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { success: true };
    });

    expect(result).toEqual({ success: true });
  });

  it('recreates a closed transaction pool through the same maintained owner', async () => {
    await closeAllPools();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));
    const neonDb = createClient({
      connectionString: 'postgresql://user:pass@ep-cool.neon.tech/mydb',
    });
    await withTransaction(neonDb, async () => 'first');
    await closeAllPools();
    await withTransaction(neonDb, async () => 'after-shutdown');
    expect(getPoolMetrics()).toHaveLength(1);
    expect(mockPoolEnd).toHaveBeenCalled();
  });

  it('borrows one lease for nested transactions and releases it once after rollback', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ transaction: mockTransaction }),
    );
    const db = createClient({
      connectionString: 'postgresql://user:pass@localhost/test',
      poolMax: 1,
    });
    let context: ReturnType<typeof getTransactionContext> = null;
    const factoryPool = (db as unknown as { $client: Pool }).$client;
    await expect(
      withTransaction(db, async (tx) => {
        context = getTransactionContext(factoryPool);
        expect(context?.connection).toBe(mockConnection);
        expect(getTransactionConnection(factoryPool)).toBe(mockConnection);
        await withTransaction(tx, async () => 'nested');
        throw new Error('rollback owning transaction');
      }),
    ).rejects.toThrow('rollback owning transaction');
    expect(mockPoolConnect).toHaveBeenCalledOnce();
    expect(mockConnection.release).toHaveBeenCalledOnce();
    await expect(context!.transaction(async () => 'stale')).rejects.toThrow('scope has ended');
  });

  it('serializes sibling savepoints and permits nested work after a sibling rolls back', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ transaction: mockTransaction }),
    );
    const db = createClient({ connectionString: 'postgresql://user:pass@localhost/test' });
    const order: string[] = [];
    await withTransaction(db, async (tx) => {
      const results = await Promise.allSettled([
        withTransaction(tx, async () => {
          order.push('first');
          await Promise.resolve();
          order.push('rollback');
          throw new Error('first failed');
        }),
        withTransaction(tx, async (child) => {
          order.push('second');
          await withTransaction(child, async () => {
            order.push('grandchild');
          });
        }),
      ]);
      expect(results.map((result) => result.status)).toEqual(['rejected', 'fulfilled']);
    });
    expect(order).toEqual(['first', 'rollback', 'second', 'grandchild']);
    expect(mockPoolConnect).toHaveBeenCalledOnce();
    expect(mockConnection.release).toHaveBeenCalledOnce();
  });

  it('returns the active transaction from the canonical getter without borrowing another connection', async () => {
    const oldUrl = process.env.POSTGRES_URL;
    process.env.POSTGRES_URL = 'postgresql://user:pass@localhost/test';
    try {
      const db = getClient();
      const pool = getRestPool();
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ transaction: mockTransaction }),
      );
      await withTransaction(db, async (tx) => {
        expect(getClient()).toBe(tx);
        expect(getRestPool()).toBe(pool);
        expect(getTransactionConnection(pool!)).toBe(mockConnection);
      });
      expect(getClient()).toBe(db);
      expect(getTransactionContext(pool!)).toBeNull();
    } finally {
      if (oldUrl === undefined) delete process.env.POSTGRES_URL;
      else process.env.POSTGRES_URL = oldUrl;
    }
  });

  it('does not lend a released lease to detached asynchronous descendants', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ transaction: mockTransaction }),
    );
    const db = createClient({ connectionString: 'postgresql://user:pass@localhost/test' });
    const pool = (db as unknown as { $client: Pool }).$client;
    let resume!: () => void;
    const barrier = new Promise<void>((resolve) => {
      resume = resolve;
    });
    let descendant!: Promise<ReturnType<typeof getTransactionContext>>;
    await withTransaction(db, async () => {
      descendant = (async () => {
        await barrier;
        return getTransactionContext(pool);
      })();
    });
    resume();
    expect(await descendant).toBeNull();
    expect(mockConnection.release).toHaveBeenCalledOnce();
  });

  it('rejects unsupported pool capacity at the maintained factory', () => {
    for (const poolMax of [0, -1, 1.5, Number.NaN])
      expect(() =>
        createClient({
          connectionString: 'postgresql://user:pass@localhost/test',
          poolMax,
        }),
      ).toThrow('positive safe integer');
    expect(mockPoolConnect).not.toHaveBeenCalled();
  });
});
