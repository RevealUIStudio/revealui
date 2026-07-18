/**
 * Integration coverage for the edit-mode wiring seam: HomePage/ProductsPage now
 * derive their `annotation` from `useMarketingPageBlocks` instead of a hardcoded
 * inactive value, and that hook consumes the edit-mode draft store (`../../lib/
 * edit-mode`). This proves the pieces are actually connected end to end (each
 * piece already had its own unit coverage: `page-blocks.test.tsx`'s slot paths,
 * `components/__tests__/block-annotations.test.tsx`'s fieldAttrs emission, and
 * `lib/use-page-blocks.test.tsx`'s draft-overlay resolution).
 */
import type { PreviewDoc } from '@revealui/editor/runtime';
import { Router, RouterProvider } from '@revealui/router';
import { act, cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPageBlocks } from '../../lib/api';
import { homeBlocks, productsBlocks } from '../../lib/page-blocks';
import { HomePage } from '../HomePage';
import { ProductsPage } from '../ProductsPage';

vi.mock('../../lib/api', () => ({ fetchPageBlocks: vi.fn() }));

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

vi.mock('../../lib/edit-mode', () => ({
  getEditDrafts: editDraftsStore.getEditDrafts,
  subscribeEditDrafts: editDraftsStore.subscribeEditDrafts,
}));

const mockFetch = vi.mocked(fetchPageBlocks);

function renderRouted(ui: ReactElement) {
  return render(<RouterProvider router={new Router()}>{ui}</RouterProvider>);
}

afterEach(cleanup);

describe('marketing pages: edit-mode wiring', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(null);
    editDraftsStore.set([]);
  });

  it('HomePage and ProductsPage emit zero data-rvui-* attributes with no active draft (regression pin)', () => {
    const home = renderRouted(<HomePage />);
    expect(home.container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
    expect(home.container.querySelectorAll('[data-rvui-doc]')).toHaveLength(0);
    home.unmount();

    const products = renderRouted(<ProductsPage />);
    expect(products.container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
    expect(products.container.querySelectorAll('[data-rvui-doc]')).toHaveLength(0);
  });

  it('HomePage renders the draft heading annotated with the session docId when a matching overlay exists', () => {
    const draftBlocks = homeBlocks();
    const section = draftBlocks[0];
    if (section?.type === 'section') {
      section.data.heading = 'Canvas-edited demo heading';
    }
    editDraftsStore.set([
      { docType: 'page', docId: 'page-home-id', draft: { slug: 'home', blocks: draftBlocks } },
    ]);

    const { container } = renderRouted(<HomePage />);
    const heading = container.querySelector('[data-rvui-field="blocks.0.heading"]');
    expect(heading?.getAttribute('data-rvui-doc')).toBe('page-home-id');
    expect(heading?.textContent).toBe('Canvas-edited demo heading');
  });

  it('ProductsPage renders the draft hero annotated with the session docId when a matching overlay exists', () => {
    const draftBlocks = productsBlocks();
    const hero = draftBlocks[0];
    if (hero?.type === 'hero') {
      hero.data.title = 'Canvas-edited hero title';
    }
    editDraftsStore.set([
      {
        docType: 'page',
        docId: 'page-products-id',
        draft: { slug: 'products', blocks: draftBlocks },
      },
    ]);

    const { container } = renderRouted(<ProductsPage />);
    const title = container.querySelector('[data-rvui-field="blocks.0.title"]');
    expect(title?.getAttribute('data-rvui-doc')).toBe('page-products-id');
    expect(title?.textContent).toBe('Canvas-edited hero title');
  });

  it('re-renders HomePage with the patched value after an optimistic draft-store update', () => {
    const { container } = renderRouted(<HomePage />);
    expect(container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);

    const draftBlocks = homeBlocks();
    const section = draftBlocks[0];
    if (section?.type === 'section') {
      section.data.heading = 'Optimistically re-rendered heading';
    }
    act(() => {
      editDraftsStore.set([
        { docType: 'page', docId: 'page-home-id', draft: { slug: 'home', blocks: draftBlocks } },
      ]);
    });

    const heading = container.querySelector('[data-rvui-field="blocks.0.heading"]');
    expect(heading?.getAttribute('data-rvui-doc')).toBe('page-home-id');
    expect(heading?.textContent).toBe('Optimistically re-rendered heading');
  });
});
