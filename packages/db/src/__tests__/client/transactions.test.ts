/**
 * Transaction Handling Tests
 *
 * Tests for the withTransaction helper in packages/db/src/client/index.ts.
 * These tests verify:
 * - Neon and self-hosted PostgreSQL URLs use the interactive pg transaction API
 * - Rollback behavior on error
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

const mockTransaction = vi.fn();
const mockPoolEnd = vi.fn().mockResolvedValue(undefined);

vi.mock('pg', () => {
  class MockPool {
    totalCount = 5;
    idleCount = 3;
    waitingCount = 0;
    end = mockPoolEnd;
    on = vi.fn();
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
    transaction: mockTransaction,
  })),
}));

// ============================================================================
// Import once to avoid dynamic import timeouts
// ============================================================================

import { createClient, resetClient, withTransaction } from '../../client/index.js';

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

  it('uses the interactive PostgreSQL transaction API for Neon URLs', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ insert: vi.fn(), update: vi.fn() }),
    );
    const neonDb = createClient({
      connectionString: 'postgresql://user:pass@ep-cool.neon.tech/mydb',
    });

    await expect(withTransaction(neonDb, async () => 'result')).resolves.toBe('result');
    expect(mockTransaction).toHaveBeenCalledOnce();
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

  it('does not treat Neon as a stateless HTTP client', async () => {
    const neonDb = createClient({
      connectionString: 'postgresql://user:pass@ep-cool.neon.tech/mydb',
    });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));
    await expect(withTransaction(neonDb, async () => 'x')).resolves.toBe('x');
  });
});
