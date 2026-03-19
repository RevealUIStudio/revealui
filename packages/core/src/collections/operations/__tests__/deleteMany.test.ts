/**
 * deleteMany Operation Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevealCollectionConfig } from '../../../types/index.js';
import { deleteMany } from '../deleteMany.js';

vi.mock('../delete.js', () => ({
  deleteDocument: vi.fn(),
}));

import { deleteDocument } from '../delete.js';

const mockConfig: RevealCollectionConfig = {
  slug: 'test-collection',
  fields: [],
};

const mockDb = {
  query: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deleteMany', () => {
  it('returns empty results for empty input', async () => {
    const result = await deleteMany(mockConfig, mockDb as never, { ids: [] });
    expect(result).toEqual({ results: [], errors: [] });
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('commits transaction when all deletes succeed', async () => {
    vi.mocked(deleteDocument)
      .mockResolvedValueOnce({ id: '1' } as never)
      .mockResolvedValueOnce({ id: '2' } as never);
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await deleteMany(mockConfig, mockDb as never, { ids: ['1', '2'] });

    expect(result.results).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(mockDb.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockDb.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('rolls back on access denial', async () => {
    vi.mocked(deleteDocument)
      .mockResolvedValueOnce({ id: '1' } as never)
      .mockRejectedValueOnce(
        new Error('Access denied: insufficient permissions to delete this document'),
      );
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await deleteMany(mockConfig, mockDb as never, { ids: ['1', '2'] });

    expect(result.results).toHaveLength(0);
    expect(result.errors[0]).toMatchObject({ index: 1 });
    expect(result.errors[0]?.error).toContain('Access denied');
    expect(mockDb.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('processes independently when no db adapter provided', async () => {
    vi.mocked(deleteDocument)
      .mockResolvedValueOnce({ id: '1' } as never)
      .mockRejectedValueOnce(new Error('not found'));

    const result = await deleteMany(mockConfig, null, { ids: ['1', '2'] });

    expect(result.results).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ index: 1 });
  });
});
