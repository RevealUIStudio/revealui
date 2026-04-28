import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

// Mock DB chain builder
function createMockDb() {
  const rows: Record<string, unknown[]> = {};

  const mockDb = {
    _rows: rows,
    _updates: [] as Array<{ table: string; values: Record<string, unknown>; ids: string[] }>,

    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockImplementation((table: { _: { name: string } }) => {
      const tableName = table?._?.name ?? 'unknown';
      return {
        where: vi.fn().mockImplementation(() => ({
          orderBy: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation((n: number) => {
              const data = rows[tableName] ?? [];
              return Promise.resolve(data.slice(0, n));
            }),
          })),
          // For count queries (no orderBy)
          then: undefined as unknown,
        })),
      };
    }),

    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((values: Record<string, unknown>) => ({
        where: vi.fn().mockImplementation(() => {
          mockDb._updates.push({ table: 'updated', values, ids: [] });
          return Promise.resolve();
        }),
      })),
    })),
  };

  return mockDb;
}

import { capResourcesOnDowngrade, isDowngrade } from '../downgrade-cap.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('downgrade-cap', () => {
  describe('isDowngrade', () => {
    it('detects pro → free as downgrade', () => {
      expect(isDowngrade('pro', 'free')).toBe(true);
    });

    it('detects max → pro as downgrade', () => {
      expect(isDowngrade('max', 'pro')).toBe(true);
    });

    it('detects enterprise → free as downgrade', () => {
      expect(isDowngrade('enterprise', 'free')).toBe(true);
    });

    it('does not flag free → pro as downgrade', () => {
      expect(isDowngrade('free', 'pro')).toBe(false);
    });

    it('does not flag same tier as downgrade', () => {
      expect(isDowngrade('pro', 'pro')).toBe(false);
    });

    it('does not flag upgrade as downgrade', () => {
      expect(isDowngrade('pro', 'max')).toBe(false);
    });
  });

  describe('capResourcesOnDowngrade', () => {
    it('returns no-op for non-downgrades', async () => {
      const db = createMockDb();
      const result = await capResourcesOnDowngrade(db as never, 'acct-1', 'free', 'pro');
      expect(result.capped).toBe(false);
      expect(result.sitesArchived).toBe(0);
      expect(result.membershipsRevoked).toBe(0);
    });

    it('returns no-op for same tier', async () => {
      const db = createMockDb();
      const result = await capResourcesOnDowngrade(db as never, 'acct-1', 'pro', 'pro');
      expect(result.capped).toBe(false);
    });

    it('returns no-op when account has no members', async () => {
      const db = createMockDb();
      // accountMemberships query returns empty
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await capResourcesOnDowngrade(db as never, 'acct-1', 'pro', 'free');
      expect(result.capped).toBe(false);
    });
  });
});
