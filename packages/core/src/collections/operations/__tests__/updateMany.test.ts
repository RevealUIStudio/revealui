/**
 * updateMany Operation Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevealCollectionConfig } from '../../../types/index.js';
import { updateMany } from '../updateMany.js';

vi.mock('../update.js', () => ({
  update: vi.fn(),
}));

import { update } from '../update.js';

const mockConfig: RevealCollectionConfig = {
  slug: 'test-collection',
  fields: [{ name: 'title', type: 'text' }],
};

const mockDb = {
  query: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateMany', () => {
  it('returns empty results for empty input', async () => {
    const result = await updateMany(mockConfig, mockDb as never, { updates: [] });
    expect(result).toEqual({ results: [], errors: [] });
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('commits transaction when all updates succeed', async () => {
    vi.mocked(update)
      .mockResolvedValueOnce({ id: '1', title: 'A' } as never)
      .mockResolvedValueOnce({ id: '2', title: 'B' } as never);
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await updateMany(mockConfig, mockDb as never, {
      updates: [
        { id: '1', data: { title: 'A' } },
        { id: '2', data: { title: 'B' } },
      ],
    });

    expect(result.results).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(mockDb.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockDb.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('rolls back on failure', async () => {
    vi.mocked(update)
      .mockResolvedValueOnce({ id: '1', title: 'A' } as never)
      .mockRejectedValueOnce(new Error('Document not found'));
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await updateMany(mockConfig, mockDb as never, {
      updates: [
        { id: '1', data: { title: 'A' } },
        { id: 'missing', data: { title: 'X' } },
      ],
    });

    expect(result.results).toHaveLength(0);
    expect(result.errors[0]).toMatchObject({ index: 1, error: 'Document not found' });
    expect(mockDb.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('passes overrideAccess to each update', async () => {
    vi.mocked(update).mockResolvedValue({ id: '1' } as never);
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await updateMany(mockConfig, mockDb as never, {
      updates: [{ id: '1', data: {} }],
      overrideAccess: true,
    });

    expect(update).toHaveBeenCalledWith(
      mockConfig,
      expect.anything(),
      expect.objectContaining({ overrideAccess: true }),
    );
  });
});
