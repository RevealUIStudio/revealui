/**
 * Update Operation Tests
 *
 * Unit tests for the update operation function.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealUpdateOptions,
} from '../../../types/index.js';
import { findByID } from '../findById.js';
import { update } from '../update.js';

// Mock findByID
vi.mock('../findById', () => ({
  findByID: vi.fn(),
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
  },
}));

// Mock defaultLogger
vi.mock('../../../observability/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('update operation', () => {
  const mockConfig: RevealCollectionConfig = {
    slug: 'test-collection',
    fields: [
      { name: 'title', type: 'text' },
      { name: 'email', type: 'email' },
      { name: 'tags', type: 'array' },
    ],
  };

  const mockDb = {
    query: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update a document', async () => {
    const options: RevealUpdateOptions = {
      id: 'test-id',
      data: {
        title: 'Updated Title',
      },
    };

    const mockUpdatedDoc = {
      id: 'test-id',
      title: 'Updated Title',
    };

    // Mock initial query to fetch existing document (returns empty JSON object)
    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ _json: '{}' }],
      } as DatabaseResult)
      .mockResolvedValueOnce({ rows: [] } as DatabaseResult);

    vi.mocked(findByID).mockResolvedValue(mockUpdatedDoc as never);

    const result = await update(mockConfig, mockDb as never, options);

    expect(result).toEqual(mockUpdatedDoc);
    expect(mockDb.query).toHaveBeenCalled();
    expect(findByID).toHaveBeenCalledWith(mockConfig, mockDb, {
      id: 'test-id',
    });
  });

  it('should validate email format', async () => {
    const options: RevealUpdateOptions = {
      id: 'test-id',
      data: {
        email: 'invalid-email',
      },
    };

    mockDb.query.mockResolvedValue({
      rows: [{ id: 'test-id' }],
    } as DatabaseResult);

    await expect(update(mockConfig, mockDb as never, options)).rejects.toThrow(
      "Field 'email' must be a valid email address",
    );
  });

  it('should throw error if document not found', async () => {
    const options: RevealUpdateOptions = {
      id: 'non-existent',
      data: {
        title: 'Updated',
      },
    };

    mockDb.query.mockResolvedValue({
      rows: [],
    } as DatabaseResult);

    await expect(update(mockConfig, mockDb as never, options)).rejects.toThrow(
      'Document with id non-existent not found',
    );
  });

  it('should merge existing JSON fields with updates', async () => {
    const options: RevealUpdateOptions = {
      id: 'test-id',
      data: {
        tags: ['new-tag'],
      },
    };

    const mockUpdatedDoc = {
      id: 'test-id',
      tags: ['new-tag'],
    };

    // Mock existing _json
    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ _json: JSON.stringify({ tags: ['old-tag'] }) }],
      } as DatabaseResult)
      .mockResolvedValueOnce({ rows: [] } as DatabaseResult);

    vi.mocked(findByID).mockResolvedValue(mockUpdatedDoc as never);

    const result = await update(mockConfig, mockDb as never, options);

    expect(result).toEqual(mockUpdatedDoc);
    // Verify _json was fetched and merged
    expect(mockDb.query).toHaveBeenCalledWith(
      'SELECT _json, id FROM "test-collection" WHERE id = $1 LIMIT 1',
      ['test-id'],
    );
  });

  it('should throw error if document not found after update', async () => {
    const options: RevealUpdateOptions = {
      id: 'test-id',
      data: {
        title: 'Updated',
      },
    };

    mockDb.query.mockResolvedValue({
      rows: [{ id: 'test-id' }],
    } as DatabaseResult);
    vi.mocked(findByID).mockResolvedValue(null);

    await expect(update(mockConfig, mockDb as never, options)).rejects.toThrow(
      'Document with id test-id not found after update',
    );
  });

  it('should return data with id when db is null', async () => {
    const options: RevealUpdateOptions = {
      id: 'test-id',
      data: {
        title: 'Updated',
      },
    };

    const result = await update(mockConfig, null, options);

    expect(result).toEqual({
      id: 'test-id',
      title: 'Updated',
    });
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('should use version-aware update when version is provided', async () => {
    const options: RevealUpdateOptions = {
      id: 'test-id',
      data: {
        title: 'Updated Title',
        version: 3,
      },
    };

    const mockUpdatedDoc = {
      id: 'test-id',
      title: 'Updated Title',
      version: 4,
    };

    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ _json: '{}' }],
      } as DatabaseResult)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as DatabaseResult);

    vi.mocked(findByID).mockResolvedValue(mockUpdatedDoc as never);

    const result = await update(mockConfig, mockDb as never, options);

    expect(result).toEqual(mockUpdatedDoc);
    // The UPDATE query should include version in WHERE and version + 1 in SET
    const updateCall = mockDb.query.mock.calls[1];
    expect(updateCall[0]).toContain('"version" = "version" + 1');
    expect(updateCall[0]).toContain('AND "version" =');
    // Version value (3) should be in params, and 'version' should NOT be in SET clause
    expect(updateCall[1]).toContain(3);
  });

  it('should throw 409 on version conflict', async () => {
    const options: RevealUpdateOptions = {
      id: 'test-id',
      data: {
        title: 'Updated Title',
        version: 2,
      },
    };

    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ _json: '{}' }],
      } as DatabaseResult)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as DatabaseResult);

    await expect(update(mockConfig, mockDb as never, options)).rejects.toThrow(
      'Document was modified by another user',
    );
  });

  it('should run beforeValidate hooks before DB write on update', async () => {
    // Config with a beforeValidate hook that auto-fills slug from title on update
    const configWithSlugHook: RevealCollectionConfig = {
      slug: 'articles',
      fields: [
        { name: 'title', type: 'text' },
        {
          name: 'slug',
          type: 'text',
          hooks: {
            beforeValidate: [
              ({ value, data }: { value: unknown; data?: Record<string, unknown> }) => {
                if (value) return value;
                const title = data?.title;
                return typeof title === 'string' ? title.replace(/ /g, '-').toLowerCase() : value;
              },
            ],
          },
        },
      ],
    };

    const options: RevealUpdateOptions = {
      id: 'doc-1',
      data: { title: 'New Title' }, // no slug submitted
    };

    const mockUpdatedDoc = { id: 'doc-1', title: 'New Title', slug: 'new-title' };

    mockDb.query
      .mockResolvedValueOnce({ rows: [{ _json: '{}' }] } as DatabaseResult) // _json fetch
      .mockResolvedValueOnce({ rows: [] } as DatabaseResult); // UPDATE

    vi.mocked(findByID).mockResolvedValue(mockUpdatedDoc as never);

    await update(configWithSlugHook, mockDb as never, options);

    // The UPDATE SET clause should include the hook-generated slug
    const updateCall = mockDb.query.mock.calls[1];
    expect(updateCall[0]).toContain('"slug"');
    expect(updateCall[1]).toContain('new-title');
  });
});

describe('update operation — typed-storage write seam', () => {
  const seamConfig: RevealCollectionConfig = {
    slug: 'pages',
    fields: [{ name: 'title', type: 'text' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the adapter document and skips the dynamic SQL path when handled', async () => {
    const handledDoc = { id: 'p1', title: 'Updated' };
    const db = {
      query: vi.fn(),
      collectionStorage: { update: vi.fn().mockResolvedValue(handledDoc) },
    };

    const result = await update(seamConfig, db as never, { id: 'p1', data: { title: 'Updated' } });

    expect(result).toEqual(handledDoc);
    expect(db.collectionStorage.update).toHaveBeenCalledWith(seamConfig, {
      id: 'p1',
      data: { title: 'Updated' },
    });
    expect(db.query).not.toHaveBeenCalled();
    expect(findByID).not.toHaveBeenCalled();
  });

  it('falls through to the dynamic SQL path when the adapter returns undefined', async () => {
    const db = {
      query: vi.fn(),
      collectionStorage: { update: vi.fn().mockResolvedValue(undefined) },
    };
    // No JSON fields → update verifies existence (rows[0] truthy) then runs UPDATE.
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'p2' }] } as DatabaseResult) // existence check
      .mockResolvedValueOnce({ rows: [] } as DatabaseResult); // UPDATE
    const dynamicDoc = { id: 'p2', title: 'Updated' };
    vi.mocked(findByID).mockResolvedValue(dynamicDoc as never);

    const result = await update(seamConfig, db as never, { id: 'p2', data: { title: 'Updated' } });

    expect(db.collectionStorage.update).toHaveBeenCalled();
    expect(db.query).toHaveBeenCalled(); // dynamic UPDATE ran
    expect(result).toEqual(dynamicDoc);
  });
});
