import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentMemories } from '../../schema/agents.js';
import { ragChunks, ragDocuments } from '../../schema/rag.js';
import { sites } from '../../schema/sites.js';
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
 * Creates a mock Drizzle DB client whose `select().from(table)` returns the
 * rows configured for that table reference (and empty otherwise). One client
 * handles BOTH the sites query and the per-table orphan queries — the dual-DB
 * branching that this module historically had collapsed into single-DB
 * NeonDB during the Supabase phase-out.
 */
function createMockDb(selectResults: Map<unknown, unknown[]> = new Map()) {
  const selectMock = vi.fn().mockImplementation(() => {
    const chain = createSelectChain([]);
    chain.from.mockImplementation((table: unknown) => {
      const result = selectResults.get(table) ?? [];
      return createSelectChain(result);
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

describe('cleanupOrphanedVectorData (single-DB)', () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    configureCleanup({});
  });

  afterEach(() => {
    configureCleanup({});
  });

  // ---- No deleted sites ---------------------------------------------------

  it('returns zero counts when no sites are deleted', async () => {
    db = createMockDb(new Map([[sites, []]]));

    const result = await cleanupOrphanedVectorData(db as never);

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

    db = createMockDb(
      new Map<unknown, unknown[]>([
        [sites, deletedSites],
        [agentMemories, orphanedMemories],
        [ragDocuments, orphanedDocuments],
        [ragChunks, orphanedChunks],
      ]),
    );

    const result = await cleanupOrphanedVectorData(db as never);

    expect(result.agentMemoriesDeleted).toBe(3);
    expect(result.ragDocumentsDeleted).toBe(1);
    expect(result.ragChunksDeleted).toBe(2);
    expect(result.deletedSiteIds).toEqual(['site-1', 'site-2']);
    expect(result.dryRun).toBe(false);

    // Verify delete was called 3 times (one per table with orphans)
    expect(db.delete).toHaveBeenCalledTimes(3);
  });

  // ---- Dry-run mode -------------------------------------------------------

  it('reports counts without deleting in dry-run mode', async () => {
    configureCleanup({ dryRun: true });

    db = createMockDb(
      new Map<unknown, unknown[]>([
        [sites, [{ id: 'site-1' }]],
        [agentMemories, [{ id: 'mem-1' }]],
        [ragDocuments, []],
        [ragChunks, [{ id: 'chunk-1' }]],
      ]),
    );

    const result = await cleanupOrphanedVectorData(db as never);

    expect(result.agentMemoriesDeleted).toBe(1);
    expect(result.ragDocumentsDeleted).toBe(0);
    expect(result.ragChunksDeleted).toBe(1);
    expect(result.dryRun).toBe(true);

    // No deletes should have occurred
    expect(db.delete).not.toHaveBeenCalled();
  });

  // ---- Idempotency --------------------------------------------------------

  it('is idempotent when run multiple times', async () => {
    // First run: has orphans
    db = createMockDb(
      new Map<unknown, unknown[]>([
        [sites, [{ id: 'site-1' }]],
        [agentMemories, [{ id: 'mem-1' }]],
        [ragDocuments, []],
        [ragChunks, []],
      ]),
    );

    const result1 = await cleanupOrphanedVectorData(db as never);
    expect(result1.agentMemoriesDeleted).toBe(1);

    // Second run: no more orphans (already cleaned up)
    db = createMockDb(
      new Map<unknown, unknown[]>([
        [sites, [{ id: 'site-1' }]],
        [agentMemories, []],
        [ragDocuments, []],
        [ragChunks, []],
      ]),
    );

    const result2 = await cleanupOrphanedVectorData(db as never);

    expect(result2.agentMemoriesDeleted).toBe(0);
    expect(result2.ragDocumentsDeleted).toBe(0);
    expect(result2.ragChunksDeleted).toBe(0);
  });

  // ---- Batch size ---------------------------------------------------------

  it('respects batch size configuration', async () => {
    configureCleanup({ batchSize: 2 });

    // 3 deleted sites should require 2 batches (2 + 1) per orphan table
    const deletedSites = [{ id: 'site-1' }, { id: 'site-2' }, { id: 'site-3' }];

    let orphanQueryCount = 0;
    db = createMockDb();
    db.select.mockImplementation(() => {
      const chain = createSelectChain([]);
      chain.from.mockImplementation((table: unknown) => {
        if (table === sites) {
          return createSelectChain(deletedSites);
        }
        // Orphan queries (agentMemories / ragDocuments / ragChunks)
        orphanQueryCount++;
        return createSelectChain([]);
      });
      return chain;
    });

    await cleanupOrphanedVectorData(db as never);

    // With batchSize=2 and 3 sites, each of 3 orphan tables runs 2 batches
    // → 3 tables × 2 batches = 6 from() calls for orphan queries
    expect(orphanQueryCount).toBe(6);
  });

  // ---- configureCleanup ---------------------------------------------------

  it('configureCleanup merges with defaults', async () => {
    configureCleanup({ batchSize: 100 });
    db = createMockDb(new Map([[sites, []]]));

    const result = await cleanupOrphanedVectorData(db as never);
    expect(result.dryRun).toBe(false);
  });

  it('configureCleanup resets to defaults when called with empty object', async () => {
    configureCleanup({ batchSize: 1, dryRun: true });
    configureCleanup({});

    db = createMockDb(new Map([[sites, []]]));

    const result = await cleanupOrphanedVectorData(db as never);
    expect(result.dryRun).toBe(false);
  });

  // ---- Error propagation --------------------------------------------------

  it('propagates DB errors from the sites query', async () => {
    db = createMockDb();
    const failChain = createSelectChain();
    failChain.from.mockReturnValue(failChain);
    failChain.then = (_resolve: unknown, reject: (e: Error) => void) =>
      reject(new Error('NeonDB connection refused'));
    db.select.mockReturnValue(failChain);

    await expect(cleanupOrphanedVectorData(db as never)).rejects.toThrow(
      'NeonDB connection refused',
    );
  });

  it('propagates DB errors from orphan select queries', async () => {
    db = createMockDb();
    let orphanCallCount = 0;
    db.select.mockImplementation(() => {
      const chain = createSelectChain([]);
      chain.from.mockImplementation((table: unknown) => {
        if (table === sites) {
          return createSelectChain([{ id: 'site-1' }]);
        }
        // First orphan query fails
        if (orphanCallCount++ === 0) {
          const errorChain = createSelectChain();
          errorChain.then = (_resolve: unknown, reject: (e: Error) => void) =>
            reject(new Error('orphan query failed'));
          return errorChain;
        }
        return createSelectChain([]);
      });
      return chain;
    });

    await expect(cleanupOrphanedVectorData(db as never)).rejects.toThrow('orphan query failed');
  });

  it('propagates DB delete errors', async () => {
    db = createMockDb(
      new Map<unknown, unknown[]>([
        [sites, [{ id: 'site-1' }]],
        [agentMemories, [{ id: 'mem-1' }]],
        [ragDocuments, []],
        [ragChunks, []],
      ]),
    );
    db.delete.mockImplementation(() => ({
      where: vi.fn().mockRejectedValue(new Error('delete permission denied')),
    }));

    await expect(cleanupOrphanedVectorData(db as never)).rejects.toThrow(
      'delete permission denied',
    );
  });
});
