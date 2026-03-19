/**
 * createMany Operation Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevealCollectionConfig } from '../../../types/index.js';
import { createMany } from '../createMany.js';

// Mock the single-item create operation
vi.mock('../create.js', () => ({
  create: vi.fn(),
}));

import { create } from '../create.js';

const mockConfig: RevealCollectionConfig = {
  slug: 'test-collection',
  fields: [{ name: 'title', type: 'text', required: true }],
};

const mockDb = {
  query: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createMany', () => {
  it('returns empty results for empty input', async () => {
    const result = await createMany(mockConfig, mockDb as never, { data: [] });
    expect(result).toEqual({ results: [], errors: [] });
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('commits transaction when all creates succeed', async () => {
    const docs = [{ title: 'A' }, { title: 'B' }];
    vi.mocked(create)
      .mockResolvedValueOnce({ id: '1', title: 'A' } as never)
      .mockResolvedValueOnce({ id: '2', title: 'B' } as never);
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await createMany(mockConfig, mockDb as never, { data: docs });

    expect(result.results).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(mockDb.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockDb.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('rolls back and returns error when a create fails', async () => {
    const docs = [{ title: 'A' }, { title: 'B' }];
    vi.mocked(create)
      .mockResolvedValueOnce({ id: '1', title: 'A' } as never)
      .mockRejectedValueOnce(new Error('DB write failed'));
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await createMany(mockConfig, mockDb as never, { data: docs });

    expect(result.results).toHaveLength(0); // rolled back
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ index: 1, error: 'DB write failed' });
    expect(mockDb.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockDb.query).not.toHaveBeenCalledWith('COMMIT');
  });

  it('runs independently (no transaction) when no db adapter provided', async () => {
    vi.mocked(create)
      .mockResolvedValueOnce({ id: '1', title: 'A' } as never)
      .mockRejectedValueOnce(new Error('fail'));

    const result = await createMany(mockConfig, null, { data: [{ title: 'A' }, { title: 'B' }] });

    // Partial success: first succeeded, second failed
    expect(result.results).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ index: 1 });
  });
});
