import { beforeEach, describe, expect, it, vi } from 'vitest';
import { populateAuthors } from '@/lib/collections/Posts/hooks/populateAuthors';

type HookArgs = Parameters<typeof populateAuthors>[0];

describe('populateAuthors', () => {
  const mockFind = vi.fn();

  const createReq = () => ({
    revealui: {
      find: mockFind,
    },
  });

  const callHook = (doc: Record<string, unknown>, req?: Record<string, unknown>) =>
    populateAuthors({
      doc: doc as unknown as HookArgs['doc'],
      req: (req ?? createReq()) as unknown as HookArgs['req'],
      findMany: false,
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('populates authors with id and name from user docs', async () => {
    mockFind.mockResolvedValueOnce({
      docs: [
        { id: 'author-1', firstName: 'Alice' },
        { id: 'author-2', firstName: 'Bob' },
      ],
    });

    const doc = {
      id: 'post-1',
      authors: ['author-1', 'author-2'],
    };

    const result = await callHook(doc);

    const populated = result as typeof doc & {
      populatedAuthors: Array<{ id: string; name: string }>;
    };
    expect(populated.populatedAuthors).toEqual([
      { id: 'author-1', name: 'Alice' },
      { id: 'author-2', name: 'Bob' },
    ]);
  });

  it('handles authors as objects with id property', async () => {
    mockFind.mockResolvedValueOnce({
      docs: [{ id: 'author-1', firstName: 'Alice' }],
    });

    const doc = {
      id: 'post-1',
      authors: [{ id: 'author-1' }],
    };

    const result = await callHook(doc);

    const populated = result as typeof doc & {
      populatedAuthors: Array<{ id: string; name: string }>;
    };
    expect(populated.populatedAuthors).toEqual([{ id: 'author-1', name: 'Alice' }]);
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        where: { id: { in: ['author-1'] } },
        depth: 0,
      }),
    );
  });

  it('returns doc unchanged when revealui is not available', async () => {
    const doc = {
      id: 'post-1',
      authors: ['author-1'],
    };

    const result = await callHook(doc, {});

    expect(result).toEqual(doc);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('returns doc unchanged when authors is not present', async () => {
    const doc = { id: 'post-1' };

    const result = await callHook(doc);

    expect(mockFind).not.toHaveBeenCalled();
    expect(result).toEqual(doc);
  });

  it('returns doc unchanged when authors is not an array', async () => {
    const doc = { id: 'post-1', authors: 'single-author' };

    const result = await callHook(doc);

    expect(mockFind).not.toHaveBeenCalled();
    expect(result).toEqual(doc);
  });

  it('skips authors that cannot be found', async () => {
    mockFind.mockResolvedValueOnce({
      docs: [{ id: 'author-1', firstName: 'Alice' }],
    });

    const doc = {
      id: 'post-1',
      authors: ['author-1', 'author-missing'],
    };

    const result = await callHook(doc);

    const populated = result as typeof doc & {
      populatedAuthors: Array<{ id: string; name: string }>;
    };
    // Only author-1 is returned by find — author-missing is not in results
    expect(populated.populatedAuthors).toHaveLength(1);
    expect(populated.populatedAuthors[0]?.id).toBe('author-1');
  });

  it('skips null/undefined authors in the array', async () => {
    mockFind.mockResolvedValueOnce({
      docs: [{ id: 'author-1', firstName: 'Alice' }],
    });

    const doc = {
      id: 'post-1',
      authors: [null, 'author-1', undefined],
    };

    const result = await callHook(doc);

    const populated = result as typeof doc & {
      populatedAuthors: Array<{ id: string; name: string }>;
    };
    expect(populated.populatedAuthors).toHaveLength(1);
  });

  it('skips boolean author values', async () => {
    const doc = {
      id: 'post-1',
      authors: [true, false],
    };

    const result = await callHook(doc);

    const populated = result as typeof doc & {
      populatedAuthors: Array<{ id: string; name: string }>;
    };
    expect(populated.populatedAuthors).toBeUndefined();
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('handles batch find returning empty results', async () => {
    mockFind.mockResolvedValueOnce({ docs: [] });

    const doc = {
      id: 'post-1',
      authors: ['author-deleted'],
    };

    const result = await callHook(doc);

    const populated = result as typeof doc & {
      populatedAuthors: Array<{ id: string; name: string }>;
    };
    expect(populated.populatedAuthors).toEqual([]);
  });

  it('handles batch find throwing an error', async () => {
    mockFind.mockRejectedValueOnce(new Error('DB error'));

    const doc = {
      id: 'post-1',
      authors: ['author-1'],
    };

    const result = await callHook(doc);

    const populated = result as typeof doc & {
      populatedAuthors: Array<{ id: string; name: string }>;
    };
    // When find throws, authorDocs stays empty — populatedAuthors is set to []
    expect(populated.populatedAuthors).toEqual([]);
  });
});
