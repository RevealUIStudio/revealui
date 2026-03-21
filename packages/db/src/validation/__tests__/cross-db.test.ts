import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertCrossDbRefs,
  CrossDbReferenceError,
  findOrphanedMemories,
  safeVectorInsert,
  validateSiteExists,
  validateUserExists,
} from '../cross-db.js';

// ---------------------------------------------------------------------------
// Mock DB helpers
// ---------------------------------------------------------------------------

function createSelectChain(rows: unknown[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return chain;
}

function createMockDb() {
  return {
    select: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

// ---------------------------------------------------------------------------

describe('CrossDbReferenceError', () => {
  it('carries table, column, and referencedId fields', () => {
    const err = new CrossDbReferenceError('agentMemories', 'siteId', 'site-abc');
    expect(err.table).toBe('agentMemories');
    expect(err.column).toBe('siteId');
    expect(err.referencedId).toBe('site-abc');
    expect(err.name).toBe('CrossDbReferenceError');
    expect(err.message).toContain('site-abc');
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------

describe('validateSiteExists', () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it('returns true when the site exists', async () => {
    db.select.mockReturnValue(createSelectChain([{ id: 's1' }]));

    const result = await validateSiteExists(db as never, 's1');

    expect(result).toBe(true);
  });

  it('returns false when the site does not exist', async () => {
    db.select.mockReturnValue(createSelectChain([]));

    const result = await validateSiteExists(db as never, 'missing');

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('validateUserExists', () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it('returns true when the user exists', async () => {
    db.select.mockReturnValue(createSelectChain([{ id: 'u1' }]));

    const result = await validateUserExists(db as never, 'u1');

    expect(result).toBe(true);
  });

  it('returns false when the user does not exist', async () => {
    db.select.mockReturnValue(createSelectChain([]));

    const result = await validateUserExists(db as never, 'missing');

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('assertCrossDbRefs', () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it('resolves when both siteId and userId exist', async () => {
    db.select.mockReturnValue(createSelectChain([{ id: 'x' }]));

    await expect(
      assertCrossDbRefs(db as never, { siteId: 's1', userId: 'u1' }),
    ).resolves.toBeUndefined();
  });

  it('throws CrossDbReferenceError when siteId is missing', async () => {
    db.select
      .mockReturnValueOnce(createSelectChain([])) // site lookup → not found
      .mockReturnValueOnce(createSelectChain([{ id: 'u1' }])); // user lookup → found

    await expect(
      assertCrossDbRefs(db as never, { siteId: 'bad-site', userId: 'u1' }),
    ).rejects.toBeInstanceOf(CrossDbReferenceError);
  });

  it('throws CrossDbReferenceError when userId is missing', async () => {
    db.select
      .mockReturnValueOnce(createSelectChain([{ id: 's1' }])) // site lookup → found
      .mockReturnValueOnce(createSelectChain([])); // user lookup → not found

    await expect(
      assertCrossDbRefs(db as never, { siteId: 's1', userId: 'bad-user' }),
    ).rejects.toBeInstanceOf(CrossDbReferenceError);
  });

  it('resolves without checking when neither siteId nor userId provided', async () => {
    await expect(assertCrossDbRefs(db as never, {})).resolves.toBeUndefined();
    expect(db.select).not.toHaveBeenCalled();
  });

  it('only validates siteId when userId is omitted', async () => {
    db.select.mockReturnValueOnce(createSelectChain([{ id: 's1' }]));

    await expect(assertCrossDbRefs(db as never, { siteId: 's1' })).resolves.toBeUndefined();
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------

describe('safeVectorInsert', () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it('executes the insert when references are valid', async () => {
    db.select.mockReturnValue(createSelectChain([{ id: 's1' }]));
    const insert = vi.fn().mockResolvedValue({ id: 'mem1' });

    const result = await safeVectorInsert(db as never, insert, { siteId: 's1' });

    expect(result).toEqual({ id: 'mem1' });
    expect(insert).toHaveBeenCalledOnce();
  });

  it('throws CrossDbReferenceError before insert when siteId is invalid', async () => {
    db.select.mockReturnValue(createSelectChain([]));
    const insert = vi.fn();

    await expect(safeVectorInsert(db as never, insert, { siteId: 'bad' })).rejects.toBeInstanceOf(
      CrossDbReferenceError,
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it('rethrows the insert error when references remain valid after failure', async () => {
    db.select.mockReturnValue(createSelectChain([{ id: 's1' }]));
    const insert = vi.fn().mockRejectedValue(new Error('DB connection timeout'));

    await expect(safeVectorInsert(db as never, insert, { siteId: 's1' })).rejects.toThrow(
      'DB connection timeout',
    );
  });

  it('throws CrossDbReferenceError on insert failure when site was deleted mid-flight', async () => {
    // First call: pre-validation → site exists
    // After insert failure: re-validation → site is gone
    db.select
      .mockReturnValueOnce(createSelectChain([{ id: 's1' }])) // pre-validate
      .mockReturnValueOnce(createSelectChain([])); // re-validate after failure
    const insert = vi.fn().mockRejectedValue(new Error('constraint violation'));

    await expect(safeVectorInsert(db as never, insert, { siteId: 's1' })).rejects.toBeInstanceOf(
      CrossDbReferenceError,
    );
  });
});

// ---------------------------------------------------------------------------

describe('findOrphanedMemories', () => {
  it('returns empty arrays when all memories have valid references', async () => {
    const vectorDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([{ id: 'm1', siteId: 's1', verifiedBy: 'u1' }]),
      }),
    };
    const restDb = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 's1' }]) }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'u1' }]) }),
        }),
    };

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await findOrphanedMemories(restDb as any, vectorDb as any);

    expect(result.orphanedBySite).toHaveLength(0);
    expect(result.orphanedByUser).toHaveLength(0);
  });

  it('returns orphaned memory IDs when site no longer exists', async () => {
    const vectorDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([{ id: 'm1', siteId: 'deleted-site', verifiedBy: null }]),
      }),
    };
    const restDb = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        }) // no sites
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        }), // no users (empty uniqueUserIds skips)
    };

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await findOrphanedMemories(restDb as any, vectorDb as any);

    expect(result.orphanedBySite).toContain('m1');
  });

  it('returns empty arrays when there are no memories', async () => {
    const vectorDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      }),
    };
    const restDb = { select: vi.fn() };

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await findOrphanedMemories(restDb as any, vectorDb as any);

    expect(result.orphanedBySite).toHaveLength(0);
    expect(result.orphanedByUser).toHaveLength(0);
    // restDb.select should not be called (no memories to check)
    expect(restDb.select).not.toHaveBeenCalled();
  });
});
