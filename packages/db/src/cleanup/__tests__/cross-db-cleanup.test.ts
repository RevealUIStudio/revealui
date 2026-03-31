import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupOrphanedVectorData, configureCleanup } from '../cross-db-cleanup.js';

// =============================================================================
// Mock Drizzle chain helpers
// =============================================================================

/**
 * Creates a mock select chain that resolves to `result`.
 * Supports `.from()`, `.where()`, and direct await.
 */
function createSelectChain(result: unknown[] = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {
    from: vi.fn(),
    where: vi.fn(),
  };
  chain.then = (resolve: (v: unknown) => void) => resolve(result);
  for (const key of ['from', 'where']) {
    chain[key]!.mockReturnValue(chain);
  }
  return chain;
}

/**
 * Creates a mock delete chain that resolves after `.where()`.
 */
function createDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock Drizzle DB client with select and delete methods.
 * Accepts a map of table references -> results for select queries,
 * so different tables return different data.
 */
function createMockDb(selectResults: Map<unknown, unknown[]> = new Map()) {
  const selectMock = vi.fn().mockImplementation(() => {
    // Default empty chain; caller overrides via `fromMock`
    const chain = createSelectChain([]);
    chain.from.mockImplementation((table: unknown) => {
      const result = selectResults.get(table) ?? [];
      const innerChain = createSelectChain(result);
      return innerChain;
    });
    return chain;
  });

  const deleteMock = vi.fn().mockImplementation(() => createDeleteChain());

  return {
    select: selectMock,
    delete: deleteMock,
  };
}

type MockDb = ReturnType<typeof createMockDb>;

// =============================================================================
// Tests
// =============================================================================

describe('cleanupOrphanedVectorData', () => {
  let restDb: MockDb;
  let vectorDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset config to defaults before each test
    configureCleanup({});
  });

  afterEach(() => {
    // Reset config after each test
    configureCleanup({});
  });

  // ---- No deleted sites ---------------------------------------------------

  it('returns zero counts when no sites are deleted', async () => {
    // REST DB: sites query returns no rows with deletedAt
    restDb = createMockDb();
    vectorDb = createMockDb();

    // Override select to return empty for sites
    restDb.select.mockReturnValue(createSelectChain([]));

    const result = await cleanupOrphanedVectorData(restDb as never, vectorDb as never);

    expect(result).toEqual({
      agentMemoriesDeleted: 0,
      ragDocumentsDeleted: 0,
      ragChunksDeleted: 0,
      deletedSiteIds: [],
      dryRun: false,
    });
  });

  // ---- Finds and deletes orphaned records ---------------------------------

  it('deletes orphaned records from all three vector tables', async () => {
    const deletedSites = [{ id: 'site-1' }, { id: 'site-2' }];
    const orphanedMemories = [{ id: 'mem-1' }, { id: 'mem-2' }, { id: 'mem-3' }];
    const orphanedDocuments = [{ id: 'doc-1' }];
    const orphanedChunks = [{ id: 'chunk-1' }, { id: 'chunk-2' }];

    // REST DB: returns deleted sites
    restDb = createMockDb();
    restDb.select.mockReturnValue(createSelectChain(deletedSites));

    // Vector DB: returns orphaned records per table
    // We need to track which table is queried by intercepting .from()
    let vectorSelectCallCount = 0;
    const vectorResults = [orphanedMemories, orphanedDocuments, orphanedChunks];

    vectorDb = createMockDb();
    vectorDb.select.mockImplementation(() => {
      const chain = createSelectChain([]);
      chain.from.mockImplementation(() => {
        const idx = vectorSelectCallCount++;
        const result = vectorResults[idx] ?? [];
        return createSelectChain(result);
      });
      return chain;
    });

    const result = await cleanupOrphanedVectorData(restDb as never, vectorDb as never);

    expect(result.agentMemoriesDeleted).toBe(3);
    expect(result.ragDocumentsDeleted).toBe(1);
    expect(result.ragChunksDeleted).toBe(2);
    expect(result.deletedSiteIds).toEqual(['site-1', 'site-2']);
    expect(result.dryRun).toBe(false);

    // Verify delete was called 3 times (one per table with orphans)
    expect(vectorDb.delete).toHaveBeenCalledTimes(3);
  });

  // ---- Dry-run mode -------------------------------------------------------

  it('reports counts without deleting in dry-run mode', async () => {
    configureCleanup({ dryRun: true });

    const deletedSites = [{ id: 'site-1' }];
    const orphanedMemories = [{ id: 'mem-1' }];
    const orphanedDocuments: unknown[] = [];
    const orphanedChunks = [{ id: 'chunk-1' }];

    restDb = createMockDb();
    restDb.select.mockReturnValue(createSelectChain(deletedSites));

    let vectorSelectCallCount = 0;
    const vectorResults = [orphanedMemories, orphanedDocuments, orphanedChunks];

    vectorDb = createMockDb();
    vectorDb.select.mockImplementation(() => {
      const chain = createSelectChain([]);
      chain.from.mockImplementation(() => {
        const idx = vectorSelectCallCount++;
        return createSelectChain(vectorResults[idx] ?? []);
      });
      return chain;
    });

    const result = await cleanupOrphanedVectorData(restDb as never, vectorDb as never);

    expect(result.agentMemoriesDeleted).toBe(1);
    expect(result.ragDocumentsDeleted).toBe(0);
    expect(result.ragChunksDeleted).toBe(1);
    expect(result.dryRun).toBe(true);

    // No deletes should have occurred
    expect(vectorDb.delete).not.toHaveBeenCalled();
  });

  // ---- Idempotency --------------------------------------------------------

  it('is idempotent when run multiple times', async () => {
    // First run: has orphans
    const deletedSites = [{ id: 'site-1' }];

    restDb = createMockDb();
    restDb.select.mockReturnValue(createSelectChain(deletedSites));

    let firstRunCallCount = 0;
    vectorDb = createMockDb();
    vectorDb.select.mockImplementation(() => {
      const chain = createSelectChain([]);
      chain.from.mockImplementation(() => {
        const idx = firstRunCallCount++;
        const results = [[{ id: 'mem-1' }], [], []];
        return createSelectChain(results[idx] ?? []);
      });
      return chain;
    });

    const result1 = await cleanupOrphanedVectorData(restDb as never, vectorDb as never);
    expect(result1.agentMemoriesDeleted).toBe(1);

    // Second run: no more orphans (already cleaned up)
    vectorDb = createMockDb();
    vectorDb.select.mockImplementation(() => {
      const chain = createSelectChain([]);
      chain.from.mockImplementation(() => {
        return createSelectChain([]);
      });
      return chain;
    });

    const result2 = await cleanupOrphanedVectorData(restDb as never, vectorDb as never);

    expect(result2.agentMemoriesDeleted).toBe(0);
    expect(result2.ragDocumentsDeleted).toBe(0);
    expect(result2.ragChunksDeleted).toBe(0);
  });

  // ---- Batch size ---------------------------------------------------------

  it('respects batch size configuration', async () => {
    configureCleanup({ batchSize: 2 });

    // 3 deleted sites should require 2 batches (2 + 1)
    const deletedSites = [{ id: 'site-1' }, { id: 'site-2' }, { id: 'site-3' }];

    restDb = createMockDb();
    restDb.select.mockReturnValue(createSelectChain(deletedSites));

    // Track select calls to verify batching
    let vectorSelectCallCount = 0;
    vectorDb = createMockDb();
    vectorDb.select.mockImplementation(() => {
      const chain = createSelectChain([]);
      chain.from.mockImplementation(() => {
        vectorSelectCallCount++;
        return createSelectChain([]);
      });
      return chain;
    });

    await cleanupOrphanedVectorData(restDb as never, vectorDb as never);

    // With batchSize=2 and 3 sites, each table should be queried twice (2 batches)
    // 3 tables x 2 batches = 6 select->from calls
    expect(vectorSelectCallCount).toBe(6);
  });

  // ---- configureCleanup ---------------------------------------------------

  it('configureCleanup merges with defaults', () => {
    configureCleanup({ batchSize: 100 });
    // dryRun should still be false (default)
    // We verify by running a cleanup and checking the result
    restDb = createMockDb();
    restDb.select.mockReturnValue(createSelectChain([]));
    vectorDb = createMockDb();

    return cleanupOrphanedVectorData(restDb as never, vectorDb as never).then((result) => {
      expect(result.dryRun).toBe(false);
    });
  });

  it('configureCleanup resets to defaults when called with empty object', () => {
    configureCleanup({ batchSize: 1, dryRun: true });
    configureCleanup({});

    restDb = createMockDb();
    restDb.select.mockReturnValue(createSelectChain([]));
    vectorDb = createMockDb();

    return cleanupOrphanedVectorData(restDb as never, vectorDb as never).then((result) => {
      expect(result.dryRun).toBe(false);
    });
  });

  // ---- Error propagation --------------------------------------------------

  it('propagates REST DB errors', async () => {
    restDb = createMockDb();
    const failChain = createSelectChain();
    failChain.from.mockReturnValue(failChain);
    failChain.then = (_resolve: unknown, reject: (e: Error) => void) =>
      reject(new Error('NeonDB connection refused'));
    restDb.select.mockReturnValue(failChain);

    vectorDb = createMockDb();

    await expect(cleanupOrphanedVectorData(restDb as never, vectorDb as never)).rejects.toThrow(
      'NeonDB connection refused',
    );
  });

  it('propagates vector DB select errors', async () => {
    const deletedSites = [{ id: 'site-1' }];
    restDb = createMockDb();
    restDb.select.mockReturnValue(createSelectChain(deletedSites));

    vectorDb = createMockDb();
    vectorDb.select.mockImplementation(() => {
      const chain = createSelectChain();
      chain.from.mockImplementation(() => {
        const errorChain = createSelectChain();
        errorChain.then = (_resolve: unknown, reject: (e: Error) => void) =>
          reject(new Error('Supabase timeout'));
        return errorChain;
      });
      return chain;
    });

    await expect(cleanupOrphanedVectorData(restDb as never, vectorDb as never)).rejects.toThrow(
      'Supabase timeout',
    );
  });

  it('propagates vector DB delete errors', async () => {
    const deletedSites = [{ id: 'site-1' }];
    restDb = createMockDb();
    restDb.select.mockReturnValue(createSelectChain(deletedSites));

    let vectorSelectCallCount = 0;
    vectorDb = createMockDb();
    vectorDb.select.mockImplementation(() => {
      const chain = createSelectChain([]);
      chain.from.mockImplementation(() => {
        const idx = vectorSelectCallCount++;
        const results = [[{ id: 'mem-1' }], [], []];
        return createSelectChain(results[idx] ?? []);
      });
      return chain;
    });
    vectorDb.delete.mockImplementation(() => ({
      where: vi.fn().mockRejectedValue(new Error('delete permission denied')),
    }));

    await expect(cleanupOrphanedVectorData(restDb as never, vectorDb as never)).rejects.toThrow(
      'delete permission denied',
    );
  });
});
