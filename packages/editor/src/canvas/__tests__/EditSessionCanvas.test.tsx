/**
 * EditSessionCanvas tests (jsdom + RTL): origin-pinned click handling, PATCH on
 * commit, debounced autosave coalescing, and publish-conflict surfacing.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RVUI_CLICK } from '../../protocol.js';
import { EditSessionCanvas, pickDefaultPreviewPageId, type Fetcher } from '../EditSessionCanvas.js';

const API_BASE = 'https://api.test';
const PREVIEW_URL = 'https://www.market.test/about?rvui-edit=tok&rvui-session=sid';
const MARKETING_ORIGIN = 'https://www.market.test';
const FOREIGN_ORIGIN = 'https://evil.test';
const SESSION = 'sid';

interface Call {
  url: string;
  init?: RequestInit;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

interface FetcherOptions {
  publishStatus?: number;
  publishBody?: unknown;
}

interface MakeFetcherOptions extends FetcherOptions {
  /** When true, session has zero dirty docs (fresh open). */
  emptyDocs?: boolean;
  pages?: Array<{ id: string; slug: string }>;
}

function makeFetcher(opts: MakeFetcherOptions = {}): { fetcher: Fetcher; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, init });
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.includes('/preview-token')) {
      return jsonResponse(201, { data: { previewUrl: PREVIEW_URL } });
    }
    if (url.includes('/publish')) {
      return jsonResponse(opts.publishStatus ?? 200, opts.publishBody ?? { data: {} });
    }
    if (url.includes('/docs/page/') && method === 'PATCH') {
      return jsonResponse(200, { data: {} });
    }
    if (url.includes('/sites/') && url.includes('/pages')) {
      return jsonResponse(200, {
        data: opts.pages ?? [
          { id: 'page-products', slug: 'products' },
          { id: 'page-home', slug: 'home' },
        ],
      });
    }
    // GET session detail
    return jsonResponse(200, {
      data: {
        session: { id: SESSION, status: 'open', siteId: 'site-1' },
        docs: opts.emptyDocs ? [] : [{ id: 'ov-1', docId: 'page-1', docType: 'page' }],
      },
    });
  };
  return { fetcher, calls };
}

function clickMessage(origin: string): MessageEvent {
  return new MessageEvent('message', {
    origin,
    data: {
      type: RVUI_CLICK,
      doc: 'page-1',
      // Canonical annotation path includes `.data` (block fields live under block.data.*).
      field: 'blocks.0.data.title',
      rect: { top: 10, left: 10, width: 100, height: 20 },
      currentValue: 'Old title',
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Preview iframe and origin-pinned click listener mount in the same state
 * commit, but the listener is registered in a useEffect that runs after paint.
 * Under CI load, a single dispatch right after findByTitle can race that effect
 * and drop the message. Retry until the field editor opens.
 */
async function openFieldEditorFromPreview(): Promise<HTMLTextAreaElement> {
  await screen.findByTitle('Content preview');
  let textarea: HTMLTextAreaElement | undefined;
  await waitFor(() => {
    window.dispatchEvent(clickMessage(MARKETING_ORIGIN));
    textarea = screen.getByLabelText('Field value') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
  });
  if (!textarea) throw new Error('field editor did not open');
  return textarea;
}

describe('EditSessionCanvas', () => {
  it('mints a preview token and renders the iframe with the previewUrl', async () => {
    const { fetcher, calls } = makeFetcher();
    render(<EditSessionCanvas sessionId={SESSION} apiBaseUrl={API_BASE} fetcher={fetcher} />);
    const iframe = (await screen.findByTitle('Content preview')) as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe(PREVIEW_URL);
    expect(calls.some((c) => c.url.includes('/preview-token'))).toBe(true);
  });

  it('ignores a click message from a foreign origin', async () => {
    const { fetcher } = makeFetcher();
    render(<EditSessionCanvas sessionId={SESSION} apiBaseUrl={API_BASE} fetcher={fetcher} />);
    await screen.findByTitle('Content preview');
    // Flush the marketingOrigin effect so the origin-pinned listener is attached.
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      window.dispatchEvent(clickMessage(FOREIGN_ORIGIN));
    });
    expect(screen.queryByLabelText('Field value')).toBeNull();
  });

  it('opens the field editor for a click from the preview origin', async () => {
    const { fetcher } = makeFetcher();
    render(<EditSessionCanvas sessionId={SESSION} apiBaseUrl={API_BASE} fetcher={fetcher} />);
    const textarea = await openFieldEditorFromPreview();
    expect(textarea.value).toBe('Old title');
  });

  it('PATCHes the session doc when a field edit is saved', async () => {
    const { fetcher, calls } = makeFetcher();
    render(<EditSessionCanvas sessionId={SESSION} apiBaseUrl={API_BASE} fetcher={fetcher} />);
    const textarea = await openFieldEditorFromPreview();
    fireEvent.change(textarea, { target: { value: 'New title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const patch = calls.find((c) => (c.init?.method ?? 'GET').toUpperCase() === 'PATCH');
      expect(patch).toBeTruthy();
      expect(patch?.url).toBe(`${API_BASE}/api/content/sessions/${SESSION}/docs/page/page-1`);
      expect(JSON.parse(String(patch?.init?.body))).toEqual({
        path: 'blocks.0.data.title',
        value: 'New title',
      });
    });
  });

  it('mints preview-token with the home pageId when the session has no dirty docs', async () => {
    const { fetcher, calls } = makeFetcher({ emptyDocs: true });
    render(<EditSessionCanvas sessionId={SESSION} apiBaseUrl={API_BASE} fetcher={fetcher} />);
    await screen.findByTitle('Content preview');
    await waitFor(() => {
      const mint = calls.find((c) => c.url.includes('/preview-token'));
      expect(mint?.url).toContain('pageId=page-home');
    });
  });

  it('pickDefaultPreviewPageId prefers home then products then first', () => {
    expect(
      pickDefaultPreviewPageId([
        { id: 'p', slug: 'products' },
        { id: 'h', slug: 'home' },
      ]),
    ).toBe('h');
    expect(pickDefaultPreviewPageId([{ id: 'p', slug: 'products' }])).toBe('p');
    expect(pickDefaultPreviewPageId([{ id: 'x', slug: 'about' }])).toBe('x');
    expect(pickDefaultPreviewPageId([])).toBeUndefined();
  });

  it('debounces autosave into a single PATCH while typing', async () => {
    const { fetcher, calls } = makeFetcher();
    render(<EditSessionCanvas sessionId={SESSION} apiBaseUrl={API_BASE} fetcher={fetcher} />);
    const textarea = await openFieldEditorFromPreview();

    // Two rapid changes, NO Save click: the debounce must coalesce them.
    fireEvent.change(textarea, { target: { value: 'A' } });
    fireEvent.change(textarea, { target: { value: 'AB' } });

    await waitFor(() => {
      const patches = calls.filter((c) => (c.init?.method ?? 'GET').toUpperCase() === 'PATCH');
      expect(patches).toHaveLength(1);
      expect(JSON.parse(String(patches[0].init?.body)).value).toBe('AB');
    });
  });

  it('surfaces a publish conflict, including partiallyPublished, as plain text', async () => {
    const { fetcher } = makeFetcher({
      publishStatus: 409,
      publishBody: { partiallyPublished: ['page-1'], conflicts: [{ reason: 'version_conflict' }] },
    });
    render(<EditSessionCanvas sessionId={SESSION} apiBaseUrl={API_BASE} fetcher={fetcher} />);
    await screen.findByTitle('Content preview');

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain('version conflict');
    expect(notice.textContent).toContain('page-1');
  });
});
