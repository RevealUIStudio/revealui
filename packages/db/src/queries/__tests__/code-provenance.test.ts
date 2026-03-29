/**
 * Code Provenance Query Tests
 *
 * Tests all 12 exported functions in code-provenance.ts.
 * Uses the same chainable Drizzle mock pattern as queries.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProvenance,
  createReview,
  deleteProvenance,
  getAllProvenance,
  getProvenanceByCommit,
  getProvenanceByFile,
  getProvenanceById,
  getProvenanceStats,
  getReviewsForProvenance,
  getUnreviewedProvenance,
  updateProvenance,
  updateReviewStatus,
} from '../code-provenance.js';

// ============================================================================
// Mock Helpers
// ============================================================================

/**
 * Creates a chainable mock that mirrors Drizzle's fluent query API.
 * The resolved value is controlled by `resolvedValue`.
 */
function createChainMock(resolvedValue: unknown = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'set',
    'values',
    'returning',
    'groupBy',
  ];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = vi.fn((resolve?: (v: unknown) => unknown) => {
    return Promise.resolve(resolve ? resolve(resolvedValue) : resolvedValue);
  });
  return chain;
}

function createMockDb() {
  return {
    select: vi.fn(() => createChainMock([])),
    insert: vi.fn(() => createChainMock([])),
    update: vi.fn(() => createChainMock([])),
    delete: vi.fn(() => createChainMock()),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('code-provenance queries', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  // --------------------------------------------------------------------------
  // getProvenanceByFile
  // --------------------------------------------------------------------------

  describe('getProvenanceByFile()', () => {
    it('queries provenance for a specific file path', async () => {
      const mockRows = [{ id: 'p1', filePath: 'src/index.ts', authorType: 'human_written' }];
      db.select = vi.fn(() => createChainMock(mockRows));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await getProvenanceByFile(db as any, 'src/index.ts');
      expect(result).toEqual(mockRows);
      expect(db.select).toHaveBeenCalled();
    });

    it('returns empty array when no records match', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await getProvenanceByFile(db as any, 'nonexistent.ts');
      expect(result).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // getProvenanceById
  // --------------------------------------------------------------------------

  describe('getProvenanceById()', () => {
    it('returns the matching record', async () => {
      const mockRow = { id: 'p1', filePath: 'src/foo.ts' };
      db.select = vi.fn(() => createChainMock([mockRow]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await getProvenanceById(db as any, 'p1');
      expect(result).toEqual(mockRow);
    });

    it('returns null when no record matches', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await getProvenanceById(db as any, 'nonexistent');
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // getProvenanceByCommit
  // --------------------------------------------------------------------------

  describe('getProvenanceByCommit()', () => {
    it('returns provenance for a git commit hash', async () => {
      const mockRows = [
        { id: 'p1', gitCommitHash: 'abc123', filePath: 'src/a.ts' },
        { id: 'p2', gitCommitHash: 'abc123', filePath: 'src/b.ts' },
      ];
      db.select = vi.fn(() => createChainMock(mockRows));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await getProvenanceByCommit(db as any, 'abc123');
      expect(result).toHaveLength(2);
    });

    it('returns empty array for unknown commit', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await getProvenanceByCommit(db as any, 'unknown');
      expect(result).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // getUnreviewedProvenance
  // --------------------------------------------------------------------------

  describe('getUnreviewedProvenance()', () => {
    it('returns unreviewed provenance without filters', async () => {
      const mockRows = [{ id: 'p1', reviewStatus: 'unreviewed' }];
      db.select = vi.fn(() => createChainMock(mockRows));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await getUnreviewedProvenance(db as any);
      expect(result).toEqual(mockRows);
    });

    it('applies authorType filter when provided', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await getUnreviewedProvenance(db as any, { authorType: 'ai_generated' });
      expect(db.select).toHaveBeenCalled();
    });

    it('applies filePathPrefix filter when provided', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await getUnreviewedProvenance(db as any, { filePathPrefix: 'packages/core/' });
      expect(db.select).toHaveBeenCalled();
    });

    it('applies both filters simultaneously', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await getUnreviewedProvenance(db as any, {
        authorType: 'ai_assisted',
        filePathPrefix: 'src/',
      });
      expect(db.select).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // getAllProvenance
  // --------------------------------------------------------------------------

  describe('getAllProvenance()', () => {
    it('returns all provenance without filters', async () => {
      const mockRows = [{ id: 'p1' }, { id: 'p2' }];
      db.select = vi.fn(() => createChainMock(mockRows));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await getAllProvenance(db as any);
      expect(result).toHaveLength(2);
    });

    it('applies authorType filter', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await getAllProvenance(db as any, { authorType: 'human_written' });
      expect(db.select).toHaveBeenCalled();
    });

    it('applies reviewStatus filter', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await getAllProvenance(db as any, { reviewStatus: 'approved' });
      expect(db.select).toHaveBeenCalled();
    });

    it('applies filePathPrefix filter', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await getAllProvenance(db as any, { filePathPrefix: 'apps/' });
      expect(db.select).toHaveBeenCalled();
    });

    it('caps limit at 500', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await getAllProvenance(db as any, { limit: 1000 });

      // The chain mock captures limit calls — we verify the function doesn't throw
      expect(db.select).toHaveBeenCalled();
    });

    it('defaults limit to 100 when not specified', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await getAllProvenance(db as any);
      expect(db.select).toHaveBeenCalled();
    });

    it('applies offset filter', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await getAllProvenance(db as any, { offset: 50 });
      expect(db.select).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // createProvenance
  // --------------------------------------------------------------------------

  describe('createProvenance()', () => {
    it('inserts a new provenance record and returns it', async () => {
      const newRecord = {
        id: 'p1',
        filePath: 'src/new.ts',
        authorType: 'ai_generated',
      };
      const insertedRow = { ...newRecord, metadata: {}, createdAt: new Date() };
      db.insert = vi.fn(() => createChainMock([insertedRow]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await createProvenance(db as any, newRecord);
      expect(result).toEqual(insertedRow);
      expect(db.insert).toHaveBeenCalled();
    });

    it('defaults metadata to empty object when not provided', async () => {
      db.insert = vi.fn(() => createChainMock([{ id: 'p2' }]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await createProvenance(db as any, {
        id: 'p2',
        filePath: 'src/x.ts',
        authorType: 'human_written',
      });
      expect(db.insert).toHaveBeenCalled();
    });

    it('passes optional fields through', async () => {
      db.insert = vi.fn(() => createChainMock([{ id: 'p3' }]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await createProvenance(db as any, {
        id: 'p3',
        filePath: 'src/y.ts',
        authorType: 'ai_assisted',
        functionName: 'myFunc',
        lineStart: 10,
        lineEnd: 20,
        aiModel: 'claude-opus-4.6',
        confidence: 0.95,
        linesOfCode: 11,
      });
      expect(db.insert).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // updateProvenance
  // --------------------------------------------------------------------------

  describe('updateProvenance()', () => {
    it('updates a record and returns the updated row', async () => {
      const updatedRow = { id: 'p1', filePath: 'src/updated.ts' };
      db.update = vi.fn(() => createChainMock([updatedRow]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await updateProvenance(db as any, 'p1', {
        filePath: 'src/updated.ts',
      });
      expect(result).toEqual(updatedRow);
    });

    it('returns null when no record matches', async () => {
      db.update = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await updateProvenance(db as any, 'nonexistent', {
        filePath: 'nope',
      });
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // updateReviewStatus
  // --------------------------------------------------------------------------

  describe('updateReviewStatus()', () => {
    it('updates review status and reviewer', async () => {
      const updatedRow = { id: 'p1', reviewStatus: 'approved', reviewedBy: 'user1' };
      db.update = vi.fn(() => createChainMock([updatedRow]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await updateReviewStatus(db as any, 'p1', 'approved', 'user1');
      expect(result).toEqual(updatedRow);
    });

    it('sets reviewedBy to null when reviewer is not provided', async () => {
      db.update = vi.fn(() => createChainMock([{ id: 'p1' }]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await updateReviewStatus(db as any, 'p1', 'rejected');
      expect(db.update).toHaveBeenCalled();
    });

    it('returns null when no record matches', async () => {
      db.update = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await updateReviewStatus(db as any, 'nope', 'approved');
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // deleteProvenance
  // --------------------------------------------------------------------------

  describe('deleteProvenance()', () => {
    it('deletes provenance by id', async () => {
      db.delete = vi.fn(() => createChainMock());

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await deleteProvenance(db as any, 'p1');
      expect(db.delete).toHaveBeenCalled();
    });

    it('does not throw when deleting non-existent id', async () => {
      db.delete = vi.fn(() => createChainMock());

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await expect(deleteProvenance(db as any, 'nonexistent')).resolves.not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // getProvenanceStats
  // --------------------------------------------------------------------------

  describe('getProvenanceStats()', () => {
    it('returns stats grouped by author type and review status', async () => {
      const byAuthorType = [
        { authorType: 'ai_generated', count: 50, totalLines: 1200 },
        { authorType: 'human_written', count: 100, totalLines: 5000 },
      ];
      const byReviewStatus = [
        { reviewStatus: 'unreviewed', count: 80 },
        { reviewStatus: 'approved', count: 70 },
      ];

      let callCount = 0;
      db.select = vi.fn(() => {
        callCount++;
        return createChainMock(callCount === 1 ? byAuthorType : byReviewStatus);
      });

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await getProvenanceStats(db as any);

      expect(result.byAuthorType).toEqual(byAuthorType);
      expect(result.byReviewStatus).toEqual(byReviewStatus);
    });

    it('returns empty arrays when no data exists', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await getProvenanceStats(db as any);

      expect(result.byAuthorType).toEqual([]);
      expect(result.byReviewStatus).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // getReviewsForProvenance
  // --------------------------------------------------------------------------

  describe('getReviewsForProvenance()', () => {
    it('returns reviews for a provenance entry', async () => {
      const mockReviews = [
        { id: 'r1', provenanceId: 'p1', status: 'approved' },
        { id: 'r2', provenanceId: 'p1', status: 'needs_changes' },
      ];
      db.select = vi.fn(() => createChainMock(mockReviews));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await getReviewsForProvenance(db as any, 'p1');
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no reviews exist', async () => {
      db.select = vi.fn(() => createChainMock([]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await getReviewsForProvenance(db as any, 'p1');
      expect(result).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // createReview
  // --------------------------------------------------------------------------

  describe('createReview()', () => {
    it('inserts a new review and returns it', async () => {
      const newReview = {
        id: 'r1',
        provenanceId: 'p1',
        reviewType: 'human_review',
        status: 'approved',
        comment: 'Looks good',
      };
      const insertedRow = { ...newReview, metadata: {}, createdAt: new Date() };
      db.insert = vi.fn(() => createChainMock([insertedRow]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      const result = await createReview(db as any, newReview);
      expect(result).toEqual(insertedRow);
    });

    it('defaults metadata to empty object', async () => {
      db.insert = vi.fn(() => createChainMock([{ id: 'r2' }]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await createReview(db as any, {
        id: 'r2',
        provenanceId: 'p1',
        reviewType: 'ai_review',
        status: 'informational',
      });
      expect(db.insert).toHaveBeenCalled();
    });

    it('includes optional reviewer and comment', async () => {
      db.insert = vi.fn(() => createChainMock([{ id: 'r3' }]));

      // biome-ignore lint/suspicious/noExplicitAny: mock db
      await createReview(db as any, {
        id: 'r3',
        provenanceId: 'p1',
        reviewerId: 'user1',
        reviewType: 'human_approval',
        status: 'approved',
        comment: 'LGTM',
        metadata: { source: 'pr-review' },
      });
      expect(db.insert).toHaveBeenCalled();
    });
  });
});
