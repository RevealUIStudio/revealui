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
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPageBlocks } from '../../lib/api';
import {
  fairSourceBlocks,
  foHiwBlocks,
  foManagedBlocks,
  homeBlocks,
  localAiBlocks,
  productsBlocks,
  servicesBlocks,
} from '../../lib/page-blocks';
import { FairSourcePage } from '../FairSourcePage';
import { ForOperatorsHowItWorksPage } from '../ForOperatorsHowItWorksPage';
import { ForOperatorsManagedPage } from '../ForOperatorsManagedPage';
import { HomePage } from '../HomePage';
import { LocalAiPage } from '../LocalAiPage';
import { ProductsPage } from '../ProductsPage';
import { ServicesPage } from '../ServicesPage';

vi.mock('../../lib/api', () => ({ fetchPageBlocks: vi.fn() }));

// `editActive` stands in for the URL's `?rvui-edit=` token (`isEditModeActive()`),
// independent of whether any draft overlay exists yet.
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

vi.mock('../../lib/edit-mode', () => ({
  getEditDrafts: editDraftsStore.getEditDrafts,
  subscribeEditDrafts: editDraftsStore.subscribeEditDrafts,
  isEditModeActive: editDraftsStore.isEditModeActive,
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
    editDraftsStore.setEditActive(false);
  });

  it('HomePage, ProductsPage, LocalAiPage, FairSourcePage, ServicesPage, ForOperatorsHowItWorksPage, and ForOperatorsManagedPage emit zero data-rvui-* attributes with no active draft (regression pin)', () => {
    const home = renderRouted(<HomePage />);
    expect(home.container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
    expect(home.container.querySelectorAll('[data-rvui-doc]')).toHaveLength(0);
    home.unmount();

    const products = renderRouted(<ProductsPage />);
    expect(products.container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
    expect(products.container.querySelectorAll('[data-rvui-doc]')).toHaveLength(0);
    products.unmount();

    const localAi = renderRouted(<LocalAiPage />);
    expect(localAi.container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
    expect(localAi.container.querySelectorAll('[data-rvui-doc]')).toHaveLength(0);
    localAi.unmount();

    const fairSource = renderRouted(<FairSourcePage />);
    expect(fairSource.container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
    expect(fairSource.container.querySelectorAll('[data-rvui-doc]')).toHaveLength(0);
    fairSource.unmount();

    const services = renderRouted(<ServicesPage />);
    expect(services.container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
    expect(services.container.querySelectorAll('[data-rvui-doc]')).toHaveLength(0);
    services.unmount();

    const hiw = renderRouted(<ForOperatorsHowItWorksPage />);
    expect(hiw.container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
    expect(hiw.container.querySelectorAll('[data-rvui-doc]')).toHaveLength(0);
    hiw.unmount();

    const managed = renderRouted(<ForOperatorsManagedPage />);
    expect(managed.container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
    expect(managed.container.querySelectorAll('[data-rvui-doc]')).toHaveLength(0);
  });

  it('HomePage no longer mounts CMS-annotated homepage blocks (quote calculator is static)', () => {
    const draftBlocks = homeBlocks();
    const section = draftBlocks[0];
    if (section?.type === 'section') {
      section.data.heading = 'Canvas-edited demo heading';
    }
    editDraftsStore.set([
      { docType: 'page', docId: 'page-home-id', draft: { slug: 'home', blocks: draftBlocks } },
    ]);

    const { container } = renderRouted(<HomePage />);
    expect(container.querySelector('[data-rvui-field="blocks.0.data.heading"]')).toBeNull();
    expect(container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
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
    const title = container.querySelector('[data-rvui-field="blocks.0.data.title"]');
    expect(title?.getAttribute('data-rvui-doc')).toBe('page-products-id');
    expect(title?.textContent).toBe('Canvas-edited hero title');
  });

  it('LocalAiPage renders the draft hero annotated with the session docId when a matching overlay exists', () => {
    const draftBlocks = localAiBlocks();
    const hero = draftBlocks[0];
    if (hero?.type === 'hero') {
      hero.data.title = 'Canvas-edited local-ai title';
    }
    editDraftsStore.set([
      {
        docType: 'page',
        docId: 'page-local-ai-id',
        draft: { slug: 'local-ai', blocks: draftBlocks },
      },
    ]);

    const { container } = renderRouted(<LocalAiPage />);
    const title = container.querySelector('[data-rvui-field="blocks.0.data.title"]');
    expect(title?.getAttribute('data-rvui-doc')).toBe('page-local-ai-id');
    expect(title?.textContent).toBe('Canvas-edited local-ai title');
  });

  it('FairSourcePage renders the draft contract heading annotated with the session docId when a matching overlay exists', () => {
    const draftBlocks = fairSourceBlocks();
    const contract = draftBlocks[0];
    if (contract?.type === 'section') {
      contract.data.heading = 'Canvas-edited fair-source contract';
    }
    editDraftsStore.set([
      {
        docType: 'page',
        docId: 'page-fair-source-id',
        draft: { slug: 'fair-source', blocks: draftBlocks },
      },
    ]);

    const { container } = renderRouted(<FairSourcePage />);
    const heading = container.querySelector('[data-rvui-field="blocks.0.data.heading"]');
    expect(heading?.getAttribute('data-rvui-doc')).toBe('page-fair-source-id');
    expect(heading?.textContent).toBe('Canvas-edited fair-source contract');
  });

  it('ServicesPage renders the draft hero annotated with the session docId when a matching overlay exists', () => {
    const draftBlocks = servicesBlocks();
    const hero = draftBlocks[0];
    if (hero?.type === 'hero') {
      hero.data.title = 'Canvas-edited services title';
    }
    editDraftsStore.set([
      {
        docType: 'page',
        docId: 'page-services-id',
        draft: { slug: 'services', blocks: draftBlocks },
      },
    ]);

    const { container } = renderRouted(<ServicesPage />);
    const title = container.querySelector('[data-rvui-field="blocks.0.data.title"]');
    expect(title?.getAttribute('data-rvui-doc')).toBe('page-services-id');
    expect(title?.textContent).toBe('Canvas-edited services title');
  });

  it('ForOperatorsHowItWorksPage renders the draft hero annotated with the session docId when a matching overlay exists', () => {
    const draftBlocks = foHiwBlocks();
    const hero = draftBlocks[0];
    if (hero?.type === 'hero') {
      hero.data.title = 'Canvas-edited how-it-works title';
    }
    editDraftsStore.set([
      {
        docType: 'page',
        docId: 'page-fo-hiw-id',
        draft: { slug: 'for-operators-how-it-works', blocks: draftBlocks },
      },
    ]);

    const { container } = renderRouted(<ForOperatorsHowItWorksPage />);
    const title = container.querySelector('[data-rvui-field="blocks.0.data.title"]');
    expect(title?.getAttribute('data-rvui-doc')).toBe('page-fo-hiw-id');
    expect(title?.textContent).toBe('Canvas-edited how-it-works title');
  });

  it('ForOperatorsManagedPage renders the draft hero annotated with the session docId when a matching overlay exists', () => {
    const draftBlocks = foManagedBlocks();
    const hero = draftBlocks[0];
    if (hero?.type === 'hero') {
      hero.data.title = 'Canvas-edited managed title';
    }
    editDraftsStore.set([
      {
        docType: 'page',
        docId: 'page-fo-managed-id',
        draft: { slug: 'for-operators-managed', blocks: draftBlocks },
      },
    ]);

    const { container } = renderRouted(<ForOperatorsManagedPage />);
    const title = container.querySelector('[data-rvui-field="blocks.0.data.title"]');
    expect(title?.getAttribute('data-rvui-doc')).toBe('page-fo-managed-id');
    expect(title?.textContent).toBe('Canvas-edited managed title');
  });

  it('keeps HomePage free of CMS field annotations after an optimistic draft-store update', () => {
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

    expect(container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
  });

  it('does not bootstrap click-to-edit on the slim HomePage', async () => {
    mockFetch.mockResolvedValue({ id: 'page-home-id', blocks: null });
    editDraftsStore.setEditActive(true);

    const { container } = renderRouted(<HomePage />);
    expect(container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-rvui-field]')).toHaveLength(0);
    });
  });
});
