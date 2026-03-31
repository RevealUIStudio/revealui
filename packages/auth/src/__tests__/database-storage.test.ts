/**
 * DatabaseStorage Tests (T-04)
 *
 * Covers atomicUpdate race condition prevention, transaction fallback
 * for serverless environments, incr semantics, and TTL expiration.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFindFirst = vi.fn();
const mockInsertValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockDeleteWhere = vi.fn();
const mockTransaction = vi.fn();

const mockInsert = vi.fn().mockReturnValue({
  values: mockInsertValues.mockReturnValue({
    onConflictDoUpdate: mockOnConflictDoUpdate,
  }),
});

const mockDelete = vi.fn().mockReturnValue({
  where: mockDeleteWhere,
});

const mockDb = {
  query: {
    rateLimits: { findFirst: mockFindFirst },
  },
  insert: mockInsert,
  delete: mockDelete,
  transaction: mockTransaction,
};

vi.mock('@revealui/config', () => ({
  default: { database: { url: 'postgres://test:test@localhost/test' } },
}));

vi.mock('@revealui/db/client', () => ({
  createClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  rateLimits: { key: 'key', value: 'value', resetAt: 'resetAt', updatedAt: 'updatedAt' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => ({ type: 'eq' })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  gte: vi.fn((_col, _val) => ({ type: 'gte' })),
}));

// ─── Import under test ───────────────────────────────────────────────────────

import { DatabaseStorage } from '../server/storage/database.js';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DatabaseStorage', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage('postgres://test:test@localhost/test');
  });

  describe('get', () => {
    it('returns value when key exists and not expired', async () => {
      mockFindFirst.mockResolvedValue({
        key: 'k',
        value: '42',
        resetAt: new Date(Date.now() + 60000),
      });
      const result = await storage.get('k');
      expect(result).toBe('42');
    });

    it('returns null when key does not exist', async () => {
      mockFindFirst.mockResolvedValue(null);
      const result = await storage.get('missing');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('inserts with upsert on conflict', async () => {
      mockOnConflictDoUpdate.mockResolvedValue(undefined);
      await storage.set('k', 'v', 60);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'k', value: 'v' }),
      );
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    });

    it('uses 24h default TTL when not specified', async () => {
      mockOnConflictDoUpdate.mockResolvedValue(undefined);
      const before = Date.now();
      await storage.set('k', 'v');
      const after = Date.now();

      const resetAt = mockInsertValues.mock.calls[0]?.[0]?.resetAt as Date;
      const diff = resetAt.getTime() - before;
      // Should be roughly 24 hours (86400s ± 1s tolerance)
      expect(diff).toBeGreaterThan(86399 * 1000);
      expect(diff).toBeLessThan(86401 * 1000 + (after - before));
    });
  });

  describe('del', () => {
    it('deletes the key', async () => {
      mockDeleteWhere.mockResolvedValue(undefined);
      await storage.del('k');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('returns true when key exists', async () => {
      mockFindFirst.mockResolvedValue({ value: 'x' });
      expect(await storage.exists('k')).toBe(true);
    });

    it('returns false when key does not exist', async () => {
      mockFindFirst.mockResolvedValue(null);
      expect(await storage.exists('missing')).toBe(false);
    });
  });

  describe('incr', () => {
    it('returns 1 for new key', async () => {
      // Transaction executes callback with tx that returns null (no existing entry)
      mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
        const txOnConflict = vi.fn().mockResolvedValue(undefined);
        const txValues = vi.fn().mockReturnValue({ onConflictDoUpdate: txOnConflict });
        const txInsert = vi.fn().mockReturnValue({ values: txValues });
        const tx = {
          query: { rateLimits: { findFirst: vi.fn().mockResolvedValue(null) } },
          insert: txInsert,
        };
        await cb(tx);
      });

      const result = await storage.incr('counter');
      expect(result).toBe(1);
    });

    it('increments existing value', async () => {
      mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
        const txOnConflict = vi.fn().mockResolvedValue(undefined);
        const txValues = vi.fn().mockReturnValue({ onConflictDoUpdate: txOnConflict });
        const txInsert = vi.fn().mockReturnValue({ values: txValues });
        const tx = {
          query: {
            rateLimits: {
              findFirst: vi
                .fn()
                .mockResolvedValue({ value: '5', resetAt: new Date(Date.now() + 60000) }),
            },
          },
          insert: txInsert,
        };
        await cb(tx);
      });

      const result = await storage.incr('counter');
      expect(result).toBe(6);
    });
  });

  describe('atomicUpdate — transaction path', () => {
    it('executes updater within transaction', async () => {
      const updater = vi.fn().mockReturnValue({ value: 'new', ttlSeconds: 60 });

      mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
        const txOnConflict = vi.fn().mockResolvedValue(undefined);
        const txValues = vi.fn().mockReturnValue({ onConflictDoUpdate: txOnConflict });
        const txInsert = vi.fn().mockReturnValue({ values: txValues });
        const tx = {
          query: { rateLimits: { findFirst: vi.fn().mockResolvedValue(null) } },
          insert: txInsert,
        };
        await cb(tx);
      });

      await storage.atomicUpdate('k', updater);
      expect(updater).toHaveBeenCalledWith(null);
      expect(mockTransaction).toHaveBeenCalledOnce();
    });

    it('passes existing value to updater', async () => {
      const updater = vi.fn().mockReturnValue({ value: 'updated', ttlSeconds: 60 });

      mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
        const txOnConflict = vi.fn().mockResolvedValue(undefined);
        const txValues = vi.fn().mockReturnValue({ onConflictDoUpdate: txOnConflict });
        const txInsert = vi.fn().mockReturnValue({ values: txValues });
        const tx = {
          query: {
            rateLimits: {
              findFirst: vi
                .fn()
                .mockResolvedValue({ value: 'old', resetAt: new Date(Date.now() + 60000) }),
            },
          },
          insert: txInsert,
        };
        await cb(tx);
      });

      await storage.atomicUpdate('k', updater);
      expect(updater).toHaveBeenCalledWith('old');
    });

    it('treats expired entries as null', async () => {
      const updater = vi.fn().mockReturnValue({ value: 'fresh', ttlSeconds: 60 });

      mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
        const txOnConflict = vi.fn().mockResolvedValue(undefined);
        const txValues = vi.fn().mockReturnValue({ onConflictDoUpdate: txOnConflict });
        const txInsert = vi.fn().mockReturnValue({ values: txValues });
        const tx = {
          query: {
            rateLimits: {
              findFirst: vi.fn().mockResolvedValue(null), // expired entries filtered by DB
            },
          },
          insert: txInsert,
        };
        await cb(tx);
      });

      await storage.atomicUpdate('k', updater);
      expect(updater).toHaveBeenCalledWith(null);
    });
  });

  describe('atomicUpdate — transaction fallback', () => {
    it('falls back to get+set when transaction is not supported', async () => {
      mockTransaction.mockRejectedValue(new Error('transaction is not supported'));
      mockFindFirst.mockResolvedValue(null);
      mockOnConflictDoUpdate.mockResolvedValue(undefined);

      const updater = vi.fn().mockReturnValue({ value: 'fallback', ttlSeconds: 60 });

      await storage.atomicUpdate('k', updater);
      expect(updater).toHaveBeenCalledWith(null);
      // Should have called get (via findFirst) and set (via insert)
      expect(mockFindFirst).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('falls back on "Transaction" (capitalized) error', async () => {
      mockTransaction.mockRejectedValue(new Error('Transaction not available in serverless'));
      mockFindFirst.mockResolvedValue({ value: '3' });
      mockOnConflictDoUpdate.mockResolvedValue(undefined);

      const updater = vi.fn().mockReturnValue({ value: '4', ttlSeconds: 60 });

      await storage.atomicUpdate('k', updater);
      expect(updater).toHaveBeenCalledWith('3');
    });

    it('re-throws real database errors (not transaction-related)', async () => {
      mockTransaction.mockRejectedValue(new Error('Connection refused'));

      const updater = vi.fn().mockReturnValue({ value: 'x', ttlSeconds: 60 });

      await expect(storage.atomicUpdate('k', updater)).rejects.toThrow('Connection refused');
    });

    it('re-throws constraint violation errors', async () => {
      mockTransaction.mockRejectedValue(new Error('duplicate key violates unique constraint'));

      const updater = vi.fn().mockReturnValue({ value: 'x', ttlSeconds: 60 });

      await expect(storage.atomicUpdate('k', updater)).rejects.toThrow('unique constraint');
    });

    it('re-throws deadlock errors', async () => {
      mockTransaction.mockRejectedValue(new Error('deadlock detected'));

      const updater = vi.fn().mockReturnValue({ value: 'x', ttlSeconds: 60 });

      await expect(storage.atomicUpdate('k', updater)).rejects.toThrow('deadlock');
    });

    it('handles non-Error thrown values in fallback check', async () => {
      mockTransaction.mockRejectedValue('some string error');

      const updater = vi.fn().mockReturnValue({ value: 'x', ttlSeconds: 60 });

      // String "some string error" doesn't contain "transaction" → should re-throw
      await expect(storage.atomicUpdate('k', updater)).rejects.toBe('some string error');
    });
  });

  describe('atomicUpdate — updater return value', () => {
    it('writes the value returned by the updater to the database', async () => {
      let insertedValue: string | undefined;

      mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
        const txOnConflict = vi.fn().mockResolvedValue(undefined);
        const txValues = vi.fn().mockImplementation((vals: { value: string }) => {
          insertedValue = vals.value;
          return { onConflictDoUpdate: txOnConflict };
        });
        const txInsert = vi.fn().mockReturnValue({ values: txValues });
        const tx = {
          query: { rateLimits: { findFirst: vi.fn().mockResolvedValue(null) } },
          insert: txInsert,
        };
        await cb(tx);
      });

      await storage.atomicUpdate('k', () => ({ value: 'computed-result', ttlSeconds: 120 }));
      expect(insertedValue).toBe('computed-result');
    });
  });
});
