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
// tests drive it directly via `editDraftsStore.set`. `editActive` stands in
// for the URL's `?rvui-edit=` token (`isEditModeActive()`), independent of
// whether any draft overlay exists yet.
const editDraftsStore = vi.hoisted(() => {
  let drafts: PreviewDoc[] = [];
  let editActive = false;
  const listeners = new Set<() => void>();
  return {
    getEditDrafts: (): PreviewDoc[] => drafts,
    subscribeEditDrafts: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isEditModeActive: (): boolean => editActive,
    set: (next: PreviewDoc[]): void => {
      drafts = next;
      for (const listener of listeners) listener();
    },
    setEditActive: (active: boolean): void => {
      editActive = active;
    },
  };
});

vi.mock('./edit-mode', () => ({
  getEditDrafts: editDraftsStore.getEditDrafts,
  subscribeEditDrafts: editDraftsStore.subscribeEditDrafts,
  isEditModeActive: editDraftsStore.isEditModeActive,
}));

const mockFetch = vi.mocked(fetchPageBlocks);

describe('useMarketingPageBlocks', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    editDraftsStore.set([]);
    editDraftsStore.setEditActive(false);
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
    mockFetch.mockResolvedValue({ id: 'page-home-id', blocks: overridden });
    const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
    await waitFor(() => {
      const first = result.current.blocks[0];
      expect(first?.type === 'section' && first.data.heading).toBe('CMS-overridden demo heading');
    });
  });

  it('keeps the fallback when the CMS payload fails schema validation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A `section` block with no `data` is schema-invalid.
    mockFetch.mockResolvedValue({
      id: 'page-home-id',
      blocks: [{ id: 'x', type: 'section' } as unknown as Block],
    });
    const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(result.current.blocks).toBe(HOME_FALLBACK_BLOCKS);
  });

  it('keeps the fallback when the CMS payload shape does not match', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A valid hero block where the home fallback expects [section, ctaSection].
    mockFetch.mockResolvedValue({ id: 'page-home-id', blocks: productsBlocks().slice(0, 1) });
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

  describe('edit-mode fresh-session bootstrap (no draft overlay yet)', () => {
    it('activates the annotation with the CMS page id once edit mode is active and the CMS row resolves', async () => {
      mockFetch.mockResolvedValue({ id: 'page-home-id', blocks: null });
      editDraftsStore.setEditActive(true);

      const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
      // First paint: the CMS fetch hasn't resolved yet, so no docId is known.
      expect(result.current.annotation).toEqual({ editable: false });

      await waitFor(() => {
        expect(result.current.annotation).toEqual({ editable: true, docId: 'page-home-id' });
      });
      // Renders the fallback (no CMS/draft blocks in play), just annotated.
      expect(result.current.blocks).toBe(HOME_FALLBACK_BLOCKS);
    });

    it('stays inactive when edit mode is active but the page has no CMS row (static-fallback-only page)', async () => {
      mockFetch.mockResolvedValue(null);
      editDraftsStore.setEditActive(true);

      const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
      await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('home'));
      expect(result.current.annotation).toEqual({ editable: false });
    });

    it('stays inactive with a known CMS row when edit mode is not active', async () => {
      mockFetch.mockResolvedValue({ id: 'page-home-id', blocks: null });
      const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
      await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('home'));
      expect(result.current.annotation).toEqual({ editable: false });
    });

    it('prefers the draft overlay docId over the bootstrap CMS-page-id once a draft exists', () => {
      mockFetch.mockResolvedValue({ id: 'page-home-id', blocks: null });
      editDraftsStore.setEditActive(true);
      const draftBlocks = homeBlocks();
      editDraftsStore.set([
        { docType: 'page', docId: 'page-home-id', draft: { slug: 'home', blocks: draftBlocks } },
      ]);

      const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
      expect(result.current.annotation).toEqual({ editable: true, docId: 'page-home-id' });
    });
  });
});
