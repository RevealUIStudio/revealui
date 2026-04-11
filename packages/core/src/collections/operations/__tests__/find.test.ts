/**
 * Find Operation Tests
 *
 * Unit tests for the find operation function.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealFindOptions,
} from '../../../types/index.js';
import { find } from '../find.js';

describe('find operation', () => {
  const mockConfig: RevealCollectionConfig = {
    slug: 'test-collection',
    fields: [
      { name: 'title', type: 'text' },
      { name: 'created', type: 'date' },
    ],
  };

  const mockDb = {
    query: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find documents with default pagination', async () => {
    const options: RevealFindOptions = {};

    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ total: '10' }],
      } as DatabaseResult)
      .mockResolvedValueOnce({
        rows: [
          { id: '1', title: 'Doc 1' },
          { id: '2', title: 'Doc 2' },
        ],
      } as DatabaseResult);

    const result = await find(mockConfig, mockDb as never, options);

    expect(result.docs).toHaveLength(2);
    expect(result.totalDocs).toBe(10);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(1);
  });

  it('should handle custom pagination', async () => {
    const options: RevealFindOptions = {
      page: 2,
      limit: 5,
    };

    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ total: '15' }],
      } as DatabaseResult)
      .mockResolvedValueOnce({
        rows: [
          { id: '6', title: 'Doc 6' },
          { id: '7', title: 'Doc 7' },
        ],
      } as DatabaseResult);

    const result = await find(mockConfig, mockDb as never, options);

    expect(result.page).toBe(2);
    expect(result.limit).toBe(5);
    expect(result.totalPages).toBe(3);
    expect(result.pagingCounter).toBe(6);
  });

  it('should handle where clause', async () => {
    const options: RevealFindOptions = {
      where: {
        title: { equals: 'Test' },
      },
    };

    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ total: '1' }],
      } as DatabaseResult)
      .mockResolvedValueOnce({
        rows: [{ id: '1', title: 'Test' }],
      } as DatabaseResult);

    const result = await find(mockConfig, mockDb as never, options);

    expect(result.docs).toHaveLength(1);
    expect(result.docs[0].title).toBe('Test');
  });

  it('should handle sort options', async () => {
    const options: RevealFindOptions = {
      sort: {
        title: '1',
        created: '-1',
      },
    };

    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ total: '5' }],
      } as DatabaseResult)
      .mockResolvedValueOnce({
        rows: [],
      } as DatabaseResult);

    await find(mockConfig, mockDb as never, options);

    // Verify ORDER BY clause is in query
    const queryCall = mockDb.query.mock.calls[1];
    expect(queryCall[0]).toContain('ORDER BY');
    expect(queryCall[0]).toContain('"title" ASC');
    expect(queryCall[0]).toContain('"created" DESC');
  });

  it('should prefer typed collection storage when available', async () => {
    const typedDb = {
      query: vi.fn(),
      collectionStorage: {
        find: vi.fn().mockResolvedValue({
          docs: [{ id: 'typed-1', title: 'Typed Doc' }],
          totalDocs: 1,
          limit: 10,
          totalPages: 1,
          page: 1,
          pagingCounter: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        }),
      },
    };

    const result = await find(mockConfig, typedDb as never, {});

    expect(result.docs).toEqual([{ id: 'typed-1', title: 'Typed Doc' }]);
    expect(typedDb.collectionStorage.find).toHaveBeenCalledWith(mockConfig, {});
    expect(typedDb.query).not.toHaveBeenCalled();
  });

  it('should fall back to SQL when typed collection storage opts out', async () => {
    const typedDb = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ total: '1' }],
        } as DatabaseResult)
        .mockResolvedValueOnce({
          rows: [{ id: '1', title: 'Fallback Doc' }],
        } as DatabaseResult),
      collectionStorage: {
        find: vi.fn().mockResolvedValue(undefined),
      },
    };

    const result = await find(mockConfig, typedDb as never, {});

    expect(result.docs).toEqual([{ id: '1', title: 'Fallback Doc' }]);
    expect(typedDb.collectionStorage.find).toHaveBeenCalledWith(mockConfig, {});
    expect(typedDb.query).toHaveBeenCalledTimes(2);
  });

  it('should reject sort fields not defined on the collection', async () => {
    const options: RevealFindOptions = {
      sort: {
        nonexistent_field: '1',
      },
    };

    // No mock setup needed  -  the error throws before any query executes
    await expect(find(mockConfig, mockDb as never, options)).rejects.toThrow(
      'Invalid sort field: "nonexistent_field"',
    );
  });

  it('should throw error if depth is invalid', async () => {
    const options: RevealFindOptions = {
      depth: -1,
    };

    await expect(find(mockConfig, mockDb as never, options)).rejects.toThrow(
      'Depth must be between 0 and 3',
    );

    await expect(find(mockConfig, mockDb as never, { ...options, depth: 5 })).rejects.toThrow(
      'Depth must be between 0 and 3',
    );
  });

  it('should return empty results when db is null', async () => {
    const options: RevealFindOptions = {};

    const result = await find(mockConfig, null, options);

    expect(result.docs).toEqual([]);
    expect(result.totalDocs).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('should deserialize JSON fields', async () => {
    const options: RevealFindOptions = {};

    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ total: '1' }],
      } as DatabaseResult)
      .mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            _json: JSON.stringify({ tags: ['tag1', 'tag2'] }),
          },
        ],
      } as DatabaseResult);

    const result = await find(mockConfig, mockDb as never, options);

    expect(result.docs[0]).toHaveProperty('tags', ['tag1', 'tag2']);
    expect(result.docs[0]).not.toHaveProperty('_json');
  });
});
