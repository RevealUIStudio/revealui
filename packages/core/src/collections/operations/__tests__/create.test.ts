/**
 * Create Operation Tests
 *
 * Unit tests for the create operation function.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealCreateOptions,
} from '../../../types/index.js';
import { create } from '../create.js';
import { findByID } from '../findById.js';

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

describe('create operation', () => {
  const mockConfig: RevealCollectionConfig = {
    slug: 'test-collection',
    fields: [
      { name: 'title', type: 'text', required: true },
      { name: 'email', type: 'email' },
      { name: 'password', type: 'password' },
      { name: 'tags', type: 'array' },
    ],
  };

  const mockDb = {
    query: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a document with required fields', async () => {
    const options: RevealCreateOptions = {
      data: {
        title: 'Test Document',
        email: 'test@example.com',
      },
    };

    const mockCreatedDoc = {
      id: 'test-id',
      title: 'Test Document',
      email: 'test@example.com',
    };

    vi.mocked(findByID).mockResolvedValue(mockCreatedDoc as never);
    mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

    const result = await create(mockConfig, mockDb as never, options);

    expect(result).toEqual(mockCreatedDoc);
    expect(mockDb.query).toHaveBeenCalled();
    expect(findByID).toHaveBeenCalledWith(mockConfig, mockDb, {
      id: expect.any(String),
    });
  });

  it('should throw error if required field is missing', async () => {
    const options: RevealCreateOptions = {
      data: {
        email: 'test@example.com',
        // title is required but missing
      },
    };

    await expect(create(mockConfig, mockDb as never, options)).rejects.toThrow(
      "Field 'title' is required but was not provided",
    );
  });

  it('should validate email format', async () => {
    const options: RevealCreateOptions = {
      data: {
        title: 'Test',
        email: 'invalid-email',
      },
    };

    await expect(create(mockConfig, mockDb as never, options)).rejects.toThrow(
      "Field 'email' must be a valid email address",
    );
  });

  it('should handle JSON fields correctly', async () => {
    const options: RevealCreateOptions = {
      data: {
        title: 'Test',
        tags: ['tag1', 'tag2'],
      },
    };

    const mockCreatedDoc = {
      id: 'test-id',
      title: 'Test',
      tags: ['tag1', 'tag2'],
    };

    vi.mocked(findByID).mockResolvedValue(mockCreatedDoc as never);
    mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

    const result = await create(mockConfig, mockDb as never, options);

    expect(result).toEqual(mockCreatedDoc);
    // Verify _json column is included when JSON fields are present
    const queryCall = mockDb.query.mock.calls.find((call) => call[0].includes('_json'));
    expect(queryCall).toBeDefined();
  });

  it('should throw error if document not found after creation', async () => {
    const options: RevealCreateOptions = {
      data: {
        title: 'Test',
      },
    };

    vi.mocked(findByID).mockResolvedValue(null);
    mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

    await expect(create(mockConfig, mockDb as never, options)).rejects.toThrow(
      'Failed to retrieve created document',
    );
  });

  it('should run INSERT and read-back inside a transaction when db.transaction is available', async () => {
    // Regression for revealui#383 — pooled pg adapters check out a fresh
    // connection per db.query() call, so the post-INSERT findByID can see
    // a pre-INSERT snapshot. The fix wraps both in db.transaction() so they
    // share a connection + snapshot.
    const options: RevealCreateOptions = {
      data: {
        title: 'Test Document',
      },
    };

    const mockCreatedDoc = {
      id: 'test-id',
      title: 'Test Document',
    };

    const txQuery = vi.fn().mockResolvedValue({ rows: [] } as DatabaseResult);
    const mockTx = { query: txQuery };
    const txDb = {
      query: mockDb.query,
      transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        return await fn(mockTx);
      }),
    };

    vi.mocked(findByID).mockResolvedValue(mockCreatedDoc as never);

    const result = await create(mockConfig, txDb as never, options);

    expect(result).toEqual(mockCreatedDoc);
    expect(txDb.transaction).toHaveBeenCalledTimes(1);
    // INSERT must run on the tx client, not on the outer db
    expect(txQuery).toHaveBeenCalled();
    expect(mockDb.query).not.toHaveBeenCalled();
    // findByID must receive the tx, not the outer db, so it reads from the
    // same connection as the INSERT
    expect(findByID).toHaveBeenCalledWith(mockConfig, mockTx, {
      id: expect.any(String),
    });
  });

  it('should return fallback data when db is null', async () => {
    const options: RevealCreateOptions = {
      data: {
        title: 'Test',
      },
    };

    const result = await create(mockConfig, null, options);

    expect(result).toHaveProperty('id');
    expect(result.title).toBe('Test');
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('should run beforeValidate hooks before required field check', async () => {
    // Config with a required slug field that has a beforeValidate hook to generate it from title
    const configWithSlugHook: RevealCollectionConfig = {
      slug: 'articles',
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'slug',
          type: 'text',
          required: true,
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

    // Submit data without a slug  -  the hook should generate it before the required check fires
    const options: RevealCreateOptions = {
      data: { title: 'Hello World' },
    };

    const mockCreatedDoc = { id: 'rvl_1', title: 'Hello World', slug: 'hello-world' };
    vi.mocked(findByID).mockResolvedValue(mockCreatedDoc as never);
    mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

    const result = await create(configWithSlugHook, mockDb as never, options);

    expect(result).toEqual(mockCreatedDoc);
    // The INSERT should have included the hook-generated slug
    const insertCall = mockDb.query.mock.calls[0];
    expect(insertCall[0]).toContain('"slug"');
    expect(insertCall[1]).toContain('hello-world');
  });

  it('should run beforeChange hooks before DB write', async () => {
    // Config with a beforeChange hook that uppercases the title
    const configWithHook: RevealCollectionConfig = {
      slug: 'test-collection',
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          hooks: {
            beforeChange: [
              ({ value }: { value: unknown }) =>
                typeof value === 'string' ? value.toUpperCase() : value,
            ],
          },
        },
      ],
    };

    const options: RevealCreateOptions = {
      data: { title: 'hello' },
    };

    const mockCreatedDoc = { id: 'rvl_2', title: 'HELLO' };
    vi.mocked(findByID).mockResolvedValue(mockCreatedDoc as never);
    mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

    await create(configWithHook, mockDb as never, options);

    // The INSERT values array should contain the transformed (uppercased) title
    const insertCall = mockDb.query.mock.calls[0];
    expect(insertCall[1]).toContain('HELLO');
    expect(insertCall[1]).not.toContain('hello');
  });
});
