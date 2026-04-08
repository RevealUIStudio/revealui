/**
 * Tests for populateArchiveBlock hook
 *
 * After-read hook that populates archive blocks with documents from a collection.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/type-guards', () => ({
  asRecord: (val: unknown) => val,
}));

const mockFind = vi.fn();

describe('populateArchiveBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadHook() {
    const mod = await import('../populateArchiveBlock.js');
    return mod.populateArchiveBlock;
  }

  function makeReq() {
    return { revealui: { find: mockFind } } as never;
  }

  it('returns doc unchanged when no layout', async () => {
    const hook = await loadHook();
    const doc = { id: '1' };
    const result = await hook({ doc, req: makeReq(), context: {} } as never);
    expect(result).toEqual(doc);
  });

  it('returns doc unchanged when no revealui instance', async () => {
    const hook = await loadHook();
    const doc = { id: '1', layout: [{ blockType: 'archive' }] };
    const result = await hook({ doc, req: {}, context: {} } as never);
    expect(result).toEqual(doc);
  });

  it('populates archive block with collection docs', async () => {
    mockFind.mockResolvedValue({
      totalDocs: 2,
      docs: [{ id: 'prod-1' }, { id: 'prod-2' }],
    });

    const hook = await loadHook();
    const doc = {
      id: '1',
      layout: [
        {
          blockType: 'archive',
          populateBy: 'collection',
          relationTo: 'products',
          limit: 5,
        },
      ],
    };

    const result = await hook({ doc, req: makeReq(), context: {} } as never);

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'products',
        limit: 5,
        context: { isPopulatingArchiveBlock: true },
        sort: '-publishedOn',
      }),
    );
    expect((result as Record<string, unknown>).layout).toEqual([
      expect.objectContaining({
        blockType: 'archive',
        populatedDocsTotal: 2,
        populatedDocs: [
          { relationTo: 'products', value: 'prod-1' },
          { relationTo: 'products', value: 'prod-2' },
        ],
      }),
    ]);
  });

  it('skips population when already populating (prevents infinite loop)', async () => {
    const hook = await loadHook();
    const doc = {
      id: '1',
      layout: [
        {
          blockType: 'archive',
          populateBy: 'collection',
          relationTo: 'products',
        },
      ],
    };

    const result = await hook({
      doc,
      req: makeReq(),
      context: { isPopulatingArchiveBlock: true },
    } as never);

    expect(mockFind).not.toHaveBeenCalled();
    // Layout blocks should be returned unchanged
    expect((result as Record<string, unknown>).layout).toBeDefined();
  });

  it('passes through non-archive blocks unchanged', async () => {
    const hook = await loadHook();
    const doc = {
      id: '1',
      layout: [
        { blockType: 'banner', title: 'Hello' },
        { blockType: 'content', text: 'World' },
      ],
    };

    const result = await hook({ doc, req: makeReq(), context: {} } as never);
    const layout = (result as Record<string, unknown>).layout as Array<Record<string, unknown>>;

    expect(layout).toHaveLength(2);
    expect(layout[0]).toEqual({ blockType: 'banner', title: 'Hello' });
    expect(layout[1]).toEqual({ blockType: 'content', text: 'World' });
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('filters by categories when provided', async () => {
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });

    const hook = await loadHook();
    const doc = {
      id: '1',
      layout: [
        {
          blockType: 'archive',
          populateBy: 'collection',
          relationTo: 'posts',
          categories: [{ id: 'cat-1' }, { id: 'cat-2' }],
          limit: 10,
        },
      ],
    };

    await hook({ doc, req: makeReq(), context: {} } as never);

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          categories: { in: ['cat-1', 'cat-2'] },
        },
      }),
    );
  });

  it('handles category as plain string ID', async () => {
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });

    const hook = await loadHook();
    const doc = {
      id: '1',
      layout: [
        {
          blockType: 'archive',
          populateBy: 'collection',
          relationTo: 'posts',
          categories: ['cat-1', 'cat-2'],
          limit: 10,
        },
      ],
    };

    await hook({ doc, req: makeReq(), context: {} } as never);

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          categories: { in: ['cat-1', 'cat-2'] },
        },
      }),
    );
  });

  it('defaults to products collection and limit 10', async () => {
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });

    const hook = await loadHook();
    const doc = {
      id: '1',
      layout: [
        {
          blockType: 'archive',
          populateBy: 'collection',
        },
      ],
    };

    await hook({ doc, req: makeReq(), context: {} } as never);

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'products',
        limit: 10,
      }),
    );
  });

  it('handles rejected promise from find without crashing', async () => {
    mockFind.mockRejectedValue(new Error('DB unavailable'));

    const hook = await loadHook();
    const doc = {
      id: '1',
      layout: [
        {
          blockType: 'archive',
          populateBy: 'collection',
          relationTo: 'products',
        },
      ],
    };

    const result = await hook({ doc, req: makeReq(), context: {} } as never);
    // Rejected block is filtered out
    const layout = (result as Record<string, unknown>).layout as Array<unknown>;
    expect(layout).toHaveLength(0);
  });
});
