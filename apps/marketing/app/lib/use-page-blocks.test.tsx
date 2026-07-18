import type { Block } from '@revealui/contracts/content';
import type { PreviewDoc } from '@revealui/editor/runtime';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPageBlocks } from './api';
import { HOME_FALLBACK_BLOCKS, homeBlocks, productsBlocks } from './page-blocks';
import { useMarketingPageBlocks } from './use-page-blocks';

vi.mock('./api', () => ({ fetchPageBlocks: vi.fn() }));

// A controllable stand-in for the module-level edit-mode draft store: the
// runtime normally calls `setDrafts` (private) through `initEditRuntime`;
// tests drive it directly via `editDraftsStore.set`.
const editDraftsStore = vi.hoisted(() => {
  let drafts: PreviewDoc[] = [];
  const listeners = new Set<() => void>();
  return {
    getEditDrafts: (): PreviewDoc[] => drafts,
    subscribeEditDrafts: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next: PreviewDoc[]): void => {
      drafts = next;
      for (const listener of listeners) listener();
    },
  };
});

vi.mock('./edit-mode', () => ({
  getEditDrafts: editDraftsStore.getEditDrafts,
  subscribeEditDrafts: editDraftsStore.subscribeEditDrafts,
}));

const mockFetch = vi.mocked(fetchPageBlocks);

describe('useMarketingPageBlocks', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    editDraftsStore.set([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('paints with the static fallback immediately', () => {
    mockFetch.mockResolvedValue(null);
    const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
    expect(result.current.blocks).toBe(HOME_FALLBACK_BLOCKS);
  });

  it('keeps the fallback when the API errors or misses', async () => {
    mockFetch.mockResolvedValue(null);
    const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('home'));
    expect(result.current.blocks).toBe(HOME_FALLBACK_BLOCKS);
  });

  it('overrides with a valid CMS payload of matching shape', async () => {
    const overridden = homeBlocks();
    const section = overridden[0];
    if (section?.type === 'section') {
      section.data.heading = 'CMS-overridden demo heading';
    }
    mockFetch.mockResolvedValue(overridden);
    const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
    await waitFor(() => {
      const first = result.current.blocks[0];
      expect(first?.type === 'section' && first.data.heading).toBe('CMS-overridden demo heading');
    });
  });

  it('keeps the fallback when the CMS payload fails schema validation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A `section` block with no `data` is schema-invalid.
    mockFetch.mockResolvedValue([{ id: 'x', type: 'section' } as unknown as Block]);
    const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(result.current.blocks).toBe(HOME_FALLBACK_BLOCKS);
  });

  it('keeps the fallback when the CMS payload shape does not match', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A valid hero block where the home fallback expects [section, ctaSection].
    mockFetch.mockResolvedValue(productsBlocks().slice(0, 1));
    const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(result.current.blocks).toBe(HOME_FALLBACK_BLOCKS);
  });

  describe('edit-mode draft overlay', () => {
    it('stays inactive (editable: false) with no draft overlay for this page', () => {
      mockFetch.mockResolvedValue(null);
      const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
      expect(result.current.annotation).toEqual({ editable: false });
      expect(result.current.blocks).toBe(HOME_FALLBACK_BLOCKS);
    });

    it('renders the draft blocks and activates the annotation when a matching overlay exists', () => {
      mockFetch.mockResolvedValue(null);
      const draftBlocks = homeBlocks();
      const section = draftBlocks[0];
      if (section?.type === 'section') {
        section.data.heading = 'Draft-overridden demo heading';
      }
      editDraftsStore.set([
        { docType: 'page', docId: 'page-home-id', draft: { slug: 'home', blocks: draftBlocks } },
      ]);

      const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));

      expect(result.current.annotation).toEqual({ editable: true, docId: 'page-home-id' });
      const first = result.current.blocks[0];
      expect(first?.type === 'section' && first.data.heading).toBe('Draft-overridden demo heading');
    });

    it('re-renders with the new draft value when the store updates after mount', () => {
      mockFetch.mockResolvedValue(null);
      const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
      expect(result.current.annotation).toEqual({ editable: false });

      const draftBlocks = homeBlocks();
      const section = draftBlocks[0];
      if (section?.type === 'section') {
        section.data.heading = 'Optimistically patched heading';
      }
      act(() => {
        editDraftsStore.set([
          { docType: 'page', docId: 'page-home-id', draft: { slug: 'home', blocks: draftBlocks } },
        ]);
      });

      expect(result.current.annotation).toEqual({ editable: true, docId: 'page-home-id' });
      const first = result.current.blocks[0];
      expect(first?.type === 'section' && first.data.heading).toBe(
        'Optimistically patched heading',
      );
    });

    it('ignores an overlay whose slug does not match this page', () => {
      mockFetch.mockResolvedValue(null);
      const draftBlocks = homeBlocks();
      editDraftsStore.set([
        {
          docType: 'page',
          docId: 'page-products-id',
          draft: { slug: 'products', blocks: draftBlocks },
        },
      ]);
      const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
      expect(result.current.annotation).toEqual({ editable: false });
      expect(result.current.blocks).toBe(HOME_FALLBACK_BLOCKS);
    });
  });
});
