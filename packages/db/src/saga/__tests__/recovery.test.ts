import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupExpiredIdempotencyKeys, recoverStaleSagas } from '../recovery.js';

// ---------------------------------------------------------------------------
// Mock helpers — chainable Drizzle query builders
// ---------------------------------------------------------------------------

/**
 * recovery.ts uses `db.select().from(jobs).where(...)` — where() is terminal.
 * Not the same chain shape as neon-saga which uses .limit().
 */
function createSelectChain(result: unknown[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(result),
  };
  chain.from.mockReturnValue(chain);
  return chain;
}

function createUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

function createDeleteChain(returningResult: unknown[] = []) {
  return {
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returningResult),
  };
}

function createMockDb() {
  return {
    select: vi.fn().mockReturnValue(createSelectChain([])),
    update: vi.fn().mockReturnValue(createUpdateChain()),
    delete: vi.fn().mockReturnValue(createDeleteChain([])),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

// ---------------------------------------------------------------------------
// Tests — recoverStaleSagas
// ---------------------------------------------------------------------------

describe('recoverStaleSagas', () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  it('returns empty array when no stale jobs exist', async () => {
    const result = await recoverStaleSagas(db as never);

    expect(result).toEqual([]);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('recovers a stale saga job and marks it failed', async () => {
    const staleJob = {
      id: 'saga-provision-key1-123',
      name: 'saga:provision-license',
      state: 'active',
      data: {
        sagaName: 'provision-license',
        sagaKey: 'key1',
        completedSteps: [
          { name: 'insert-license', output: { id: 'lic-1' }, completedAt: '2026-04-06T00:00:00Z' },
        ],
      },
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
    };

    const selectChain = createSelectChain([staleJob]);
    db.select.mockReturnValue(selectChain);

    const result = await recoverStaleSagas(db as never);

    expect(result).toHaveLength(1);
    expect(result[0]?.sagaName).toBe('provision-license');
    expect(result[0]?.sagaKey).toBe('key1');
    expect(result[0]?.completedSteps).toEqual(['insert-license']);
    expect(db.update).toHaveBeenCalled();
  });

  it('extracts saga name from job name when data is null', async () => {
    const staleJob = {
      id: 'saga-test-key-123',
      name: 'saga:test-saga',
      state: 'active',
      data: null,
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
    };

    const selectChain = createSelectChain([staleJob]);
    db.select.mockReturnValue(selectChain);

    const result = await recoverStaleSagas(db as never);

    expect(result).toHaveLength(1);
    expect(result[0]?.sagaName).toBe('test-saga');
    expect(result[0]?.sagaKey).toBe('unknown');
    expect(result[0]?.completedSteps).toEqual([]);
  });

  it('recovers multiple stale jobs', async () => {
    const staleJobs = [
      {
        id: 'saga-a-1',
        name: 'saga:a',
        state: 'active',
        data: { sagaName: 'a', sagaKey: '1', completedSteps: [] },
        startedAt: new Date(Date.now() - 10 * 60 * 1000),
      },
      {
        id: 'saga-b-2',
        name: 'saga:b',
        state: 'active',
        data: { sagaName: 'b', sagaKey: '2', completedSteps: [] },
        startedAt: new Date(Date.now() - 15 * 60 * 1000),
      },
    ];

    const selectChain = createSelectChain(staleJobs);
    db.select.mockReturnValue(selectChain);

    const result = await recoverStaleSagas(db as never);

    expect(result).toHaveLength(2);
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('uses custom threshold', async () => {
    await recoverStaleSagas(db as never, 60_000);

    expect(db.select).toHaveBeenCalled();
  });

  it('sets recoveredAt timestamp on each result', async () => {
    const staleJob = {
      id: 'saga-x-1',
      name: 'saga:x',
      state: 'active',
      data: { sagaName: 'x', sagaKey: '1', completedSteps: [] },
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
    };

    const selectChain = createSelectChain([staleJob]);
    db.select.mockReturnValue(selectChain);

    const before = new Date();
    const result = await recoverStaleSagas(db as never);
    const after = new Date();

    expect(result[0]?.recoveredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result[0]?.recoveredAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

// ---------------------------------------------------------------------------
// Tests — cleanupExpiredIdempotencyKeys
// ---------------------------------------------------------------------------

describe('cleanupExpiredIdempotencyKeys', () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  it('returns 0 when no expired keys exist', async () => {
    const deleteChain = createDeleteChain([]);
    db.delete.mockReturnValue(deleteChain);

    const count = await cleanupExpiredIdempotencyKeys(db as never);

    expect(count).toBe(0);
  });

  it('returns the count of deleted keys', async () => {
    const deleteChain = createDeleteChain([{ key: 'key-1' }, { key: 'key-2' }, { key: 'key-3' }]);
    db.delete.mockReturnValue(deleteChain);

    const count = await cleanupExpiredIdempotencyKeys(db as never);

    expect(count).toBe(3);
  });

  it('calls delete on the database', async () => {
    const deleteChain = createDeleteChain([]);
    db.delete.mockReturnValue(deleteChain);

    await cleanupExpiredIdempotencyKeys(db as never);

    expect(db.delete).toHaveBeenCalled();
  });
});
