import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOnDocumentChanged = vi.fn();

vi.mock('@/lib/ai/indexer', () => ({
  getIndexer: vi.fn(),
}));

import { getIndexer } from '@/lib/ai/indexer';
import { indexPage } from '@/lib/collections/Pages/hooks/indexPage';

const mockGetIndexer = vi.mocked(getIndexer);

describe('indexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnDocumentChanged.mockResolvedValue(undefined);
  });

  it('calls indexer.onDocumentChanged with page data', async () => {
    mockGetIndexer.mockResolvedValue({ onDocumentChanged: mockOnDocumentChanged });

    const doc = { id: 'page-1', title: 'Test Page', slug: 'test' } as unknown as Parameters<
      typeof indexPage
    >[0]['doc'];

    const result = indexPage({
      doc,
      operation: 'create',
      req: {} as unknown as Parameters<typeof indexPage>[0]['req'],
      previousDoc: undefined as unknown as Parameters<typeof indexPage>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof indexPage>[0]['collection'],
      context: {} as unknown as Parameters<typeof indexPage>[0]['context'],
    });

    // indexPage is fire-and-forget, so we need to wait for the internal promise
    await vi.waitFor(() => {
      expect(mockOnDocumentChanged).toHaveBeenCalledWith({
        collection: 'pages',
        id: 'page-1',
        operation: 'create',
        doc: expect.objectContaining({ id: 'page-1' }),
      });
    });

    expect(result).toEqual(doc);
  });

  it('returns doc immediately (fire-and-forget)', () => {
    mockGetIndexer.mockResolvedValue({ onDocumentChanged: mockOnDocumentChanged });

    const doc = { id: 'page-2', title: 'Test' } as unknown as Parameters<
      typeof indexPage
    >[0]['doc'];

    const result = indexPage({
      doc,
      operation: 'update',
      req: {} as unknown as Parameters<typeof indexPage>[0]['req'],
      previousDoc: undefined as unknown as Parameters<typeof indexPage>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof indexPage>[0]['collection'],
      context: {} as unknown as Parameters<typeof indexPage>[0]['context'],
    });

    // Should return doc synchronously without waiting for indexer
    expect(result).toEqual(doc);
  });

  it('does not throw when indexer is null (Pro not installed)', async () => {
    mockGetIndexer.mockResolvedValue(null);

    const doc = { id: 'page-3' } as unknown as Parameters<typeof indexPage>[0]['doc'];

    const result = indexPage({
      doc,
      operation: 'create',
      req: {} as unknown as Parameters<typeof indexPage>[0]['req'],
      previousDoc: undefined as unknown as Parameters<typeof indexPage>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof indexPage>[0]['collection'],
      context: {} as unknown as Parameters<typeof indexPage>[0]['context'],
    });

    // Wait for the internal promise to settle
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockOnDocumentChanged).not.toHaveBeenCalled();
    expect(result).toEqual(doc);
  });

  it('does not throw when indexer rejects', async () => {
    mockGetIndexer.mockRejectedValue(new Error('Indexer failed'));

    const doc = { id: 'page-4' } as unknown as Parameters<typeof indexPage>[0]['doc'];

    // Should not throw despite indexer error
    const result = indexPage({
      doc,
      operation: 'create',
      req: {} as unknown as Parameters<typeof indexPage>[0]['req'],
      previousDoc: undefined as unknown as Parameters<typeof indexPage>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof indexPage>[0]['collection'],
      context: {} as unknown as Parameters<typeof indexPage>[0]['context'],
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(result).toEqual(doc);
  });

  it('does not throw when onDocumentChanged rejects', async () => {
    mockOnDocumentChanged.mockRejectedValue(new Error('Index write failed'));
    mockGetIndexer.mockResolvedValue({ onDocumentChanged: mockOnDocumentChanged });

    const doc = { id: 'page-5' } as unknown as Parameters<typeof indexPage>[0]['doc'];

    const result = indexPage({
      doc,
      operation: 'update',
      req: {} as unknown as Parameters<typeof indexPage>[0]['req'],
      previousDoc: undefined as unknown as Parameters<typeof indexPage>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof indexPage>[0]['collection'],
      context: {} as unknown as Parameters<typeof indexPage>[0]['context'],
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(result).toEqual(doc);
  });
});
