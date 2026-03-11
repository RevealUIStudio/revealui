import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOnDocumentChanged = vi.fn();

vi.mock('@/lib/ai/indexer', () => ({
  getIndexer: vi.fn(),
}));

import { getIndexer } from '@/lib/ai/indexer';
import { indexPost } from '@/lib/collections/Posts/hooks/indexPost';

const mockGetIndexer = vi.mocked(getIndexer);

describe('indexPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnDocumentChanged.mockResolvedValue(undefined);
  });

  it('calls indexer.onDocumentChanged with post data on create', async () => {
    mockGetIndexer.mockResolvedValue({ onDocumentChanged: mockOnDocumentChanged });

    const doc = { id: 'post-1', title: 'Test Post', slug: 'test-post' } as unknown as Parameters<
      typeof indexPost
    >[0]['doc'];

    const result = indexPost({
      doc,
      operation: 'create',
      req: {} as unknown as Parameters<typeof indexPost>[0]['req'],
      previousDoc: undefined as unknown as Parameters<typeof indexPost>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof indexPost>[0]['collection'],
      context: {} as unknown as Parameters<typeof indexPost>[0]['context'],
    });

    await vi.waitFor(() => {
      expect(mockOnDocumentChanged).toHaveBeenCalledWith({
        collection: 'posts',
        id: 'post-1',
        operation: 'create',
        doc: expect.objectContaining({ id: 'post-1' }),
      });
    });

    expect(result).toEqual(doc);
  });

  it('passes update operation to indexer', async () => {
    mockGetIndexer.mockResolvedValue({ onDocumentChanged: mockOnDocumentChanged });

    const doc = { id: 'post-2' } as unknown as Parameters<typeof indexPost>[0]['doc'];

    indexPost({
      doc,
      operation: 'update',
      req: {} as unknown as Parameters<typeof indexPost>[0]['req'],
      previousDoc: undefined as unknown as Parameters<typeof indexPost>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof indexPost>[0]['collection'],
      context: {} as unknown as Parameters<typeof indexPost>[0]['context'],
    });

    await vi.waitFor(() => {
      expect(mockOnDocumentChanged).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'update' }),
      );
    });
  });

  it('does not throw when indexer is null', async () => {
    mockGetIndexer.mockResolvedValue(null);

    const doc = { id: 'post-3' } as unknown as Parameters<typeof indexPost>[0]['doc'];

    const result = indexPost({
      doc,
      operation: 'create',
      req: {} as unknown as Parameters<typeof indexPost>[0]['req'],
      previousDoc: undefined as unknown as Parameters<typeof indexPost>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof indexPost>[0]['collection'],
      context: {} as unknown as Parameters<typeof indexPost>[0]['context'],
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockOnDocumentChanged).not.toHaveBeenCalled();
    expect(result).toEqual(doc);
  });

  it('swallows errors from getIndexer', async () => {
    mockGetIndexer.mockRejectedValue(new Error('AI module not available'));

    const doc = { id: 'post-4' } as unknown as Parameters<typeof indexPost>[0]['doc'];

    const result = indexPost({
      doc,
      operation: 'create',
      req: {} as unknown as Parameters<typeof indexPost>[0]['req'],
      previousDoc: undefined as unknown as Parameters<typeof indexPost>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof indexPost>[0]['collection'],
      context: {} as unknown as Parameters<typeof indexPost>[0]['context'],
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(result).toEqual(doc);
  });

  it('swallows errors from onDocumentChanged', async () => {
    mockOnDocumentChanged.mockRejectedValue(new Error('Embedding failed'));
    mockGetIndexer.mockResolvedValue({ onDocumentChanged: mockOnDocumentChanged });

    const doc = { id: 'post-5' } as unknown as Parameters<typeof indexPost>[0]['doc'];

    const result = indexPost({
      doc,
      operation: 'update',
      req: {} as unknown as Parameters<typeof indexPost>[0]['req'],
      previousDoc: undefined as unknown as Parameters<typeof indexPost>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof indexPost>[0]['collection'],
      context: {} as unknown as Parameters<typeof indexPost>[0]['context'],
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(result).toEqual(doc);
  });

  it('converts doc.id to string for indexer', async () => {
    mockGetIndexer.mockResolvedValue({ onDocumentChanged: mockOnDocumentChanged });

    const doc = { id: 42 } as unknown as Parameters<typeof indexPost>[0]['doc'];

    indexPost({
      doc,
      operation: 'create',
      req: {} as unknown as Parameters<typeof indexPost>[0]['req'],
      previousDoc: undefined as unknown as Parameters<typeof indexPost>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof indexPost>[0]['collection'],
      context: {} as unknown as Parameters<typeof indexPost>[0]['context'],
    });

    await vi.waitFor(() => {
      expect(mockOnDocumentChanged).toHaveBeenCalledWith(expect.objectContaining({ id: '42' }));
    });
  });
});
