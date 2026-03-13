/**
 * Find By ID Operation Tests
 *
 * Unit tests for the findByID operation function.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseResult, RevealCollectionConfig } from '../../../types/index.js';
import { findByID } from '../findById.js';

describe('findByID operation', () => {
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

  it('should find a document by ID', async () => {
    const mockDoc = {
      id: 'test-id',
      title: 'Test Document',
    };

    mockDb.query.mockResolvedValue({
      rows: [mockDoc],
    } as DatabaseResult);

    const result = await findByID(mockConfig, mockDb as never, {
      id: 'test-id',
    });

    expect(result).toEqual(mockDoc);
    expect(mockDb.query).toHaveBeenCalledWith(
      'SELECT * FROM "test-collection" WHERE id = $1 LIMIT 1',
      ['test-id'],
    );
  });

  it('should return null if document not found', async () => {
    mockDb.query.mockResolvedValue({
      rows: [],
    } as DatabaseResult);

    const result = await findByID(mockConfig, mockDb as never, {
      id: 'non-existent',
    });

    expect(result).toBeNull();
  });

  it('should throw error if depth is invalid', async () => {
    await expect(
      findByID(mockConfig, mockDb as never, { id: 'test-id', depth: -1 }),
    ).rejects.toThrow('Depth must be between 0 and 3');

    await expect(
      findByID(mockConfig, mockDb as never, { id: 'test-id', depth: 5 }),
    ).rejects.toThrow('Depth must be between 0 and 3');
  });

  it('should handle string and number IDs', async () => {
    const mockDoc = { id: '123', title: 'Test' };

    mockDb.query.mockResolvedValue({
      rows: [mockDoc],
    } as DatabaseResult);

    const result1 = await findByID(mockConfig, mockDb as never, { id: '123' });
    expect(result1).toEqual(mockDoc);

    const result2 = await findByID(mockConfig, mockDb as never, { id: 123 });
    expect(result2).toEqual(mockDoc);
  });

  it('should return null when db is null', async () => {
    const result = await findByID(mockConfig, null, { id: 'test-id' });

    expect(result).toBeNull();
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('should deserialize JSON fields', async () => {
    const mockDoc = {
      id: 'test-id',
      _json: JSON.stringify({ tags: ['tag1', 'tag2'] }),
    };

    mockDb.query.mockResolvedValue({
      rows: [mockDoc],
    } as DatabaseResult);

    const result = await findByID(mockConfig, mockDb as never, {
      id: 'test-id',
    });

    expect(result).toHaveProperty('tags', ['tag1', 'tag2']);
    expect(result).not.toHaveProperty('_json');
  });

  it('should prefer typed collection storage when available', async () => {
    const typedDb = {
      query: vi.fn(),
      collectionStorage: {
        findByID: vi.fn().mockResolvedValue({ id: 'typed-1', title: 'Typed Doc' }),
      },
    };

    const result = await findByID(mockConfig, typedDb as never, { id: 'typed-1' });

    expect(result).toEqual({ id: 'typed-1', title: 'Typed Doc' });
    expect(typedDb.collectionStorage.findByID).toHaveBeenCalledWith(mockConfig, { id: 'typed-1' });
    expect(typedDb.query).not.toHaveBeenCalled();
  });

  it('should fall back to SQL when typed collection storage opts out', async () => {
    const mockDoc = {
      id: 'fallback-id',
      title: 'Fallback Document',
    };

    const typedDb = {
      query: vi.fn().mockResolvedValue({
        rows: [mockDoc],
      } as DatabaseResult),
      collectionStorage: {
        findByID: vi.fn().mockResolvedValue(undefined),
      },
    };

    const result = await findByID(mockConfig, typedDb as never, {
      id: 'fallback-id',
    });

    expect(result).toEqual(mockDoc);
    expect(typedDb.collectionStorage.findByID).toHaveBeenCalledWith(mockConfig, {
      id: 'fallback-id',
    });
    expect(typedDb.query).toHaveBeenCalledWith(
      'SELECT * FROM "test-collection" WHERE id = $1 LIMIT 1',
      ['fallback-id'],
    );
  });
});
