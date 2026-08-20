/**
 * Edit-mode runtime tests (jsdom): init, draft callback, click delegation,
 * origin-pinned inbound channel (foreign + malformed messages dropped),
 * apply-patch optimistic update + ack.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RVUI_APPLY_PATCH, RVUI_CLICK, RVUI_PATCH_APPLIED, RVUI_READY } from '../../protocol.js';
import { type EditRuntimeHandle, initEditRuntime, type PreviewDoc } from '../index.js';

const API_BASE = 'https://api.test';
const ADMIN_ORIGIN = 'https://admin.test';
const FOREIGN_ORIGIN = 'https://evil.test';
/** Server-shaped UUID (crypto.randomUUID). */
const SESSION_ID = '00000000-0000-4000-8000-000000000001';
/** Preview token shape: base64url.payload.base64url.sig */
const PREVIEW_TOKEN = 'eyJzaWQiOiJ4IiwiZXhwIjoxfQ.dGVzdHNpZw';

function mockPreview(docs: PreviewDoc[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: { siteId: 'site-1', adminOrigin: ADMIN_ORIGIN, docs },
      }),
    })),
  );
}

function editUrl(): void {
  window.history.pushState(
    {},
    '',
    `/?rvui-edit=${encodeURIComponent(PREVIEW_TOKEN)}&rvui-session=${SESSION_ID}`,
  );
}

let handle: EditRuntimeHandle | null = null;
let postSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  postSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
});

afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.innerHTML = '';
  window.history.pushState({}, '', '/');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function draftDocs(): PreviewDoc[] {
  return [{ docType: 'page', docId: 'page-1', draft: { blocks: [{ title: 'Old' }] } }];
}

describe('initEditRuntime', () => {
  it('returns null when the URL carries no edit token', async () => {
    window.history.pushState({}, '', '/');
    mockPreview(draftDocs());
    handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft: () => {} });
    expect(handle).toBeNull();
  });

  it('returns null when session id or token shape is illegal (path-injection guard)', async () => {
    window.history.pushState({}, '', '/?rvui-edit=tok&rvui-session=../evil');
    mockPreview(draftDocs());
    handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft: () => {} });
    expect(handle).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns null when the preview fetch fails', async () => {
    editUrl();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })),
    );
    handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft: () => {} });
    expect(handle).toBeNull();
  });

  it('hands drafts to the host and posts rvui:ready to the admin origin', async () => {
    editUrl();
    mockPreview(draftDocs());
    const onDraft = vi.fn();
    handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft });
    expect(handle).not.toBeNull();
    expect(onDraft).toHaveBeenCalledWith([
      { docType: 'page', docId: 'page-1', draft: { blocks: [{ title: 'Old' }] } },
    ]);
    expect(postSpy).toHaveBeenCalledWith({ type: RVUI_READY }, ADMIN_ORIGIN);
  });

  it('posts rvui:click when an annotated element is clicked', async () => {
    editUrl();
    mockPreview(draftDocs());
    handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft: () => {} });

    const el = document.createElement('h1');
    el.setAttribute('data-rvui-doc', 'page-1');
    el.setAttribute('data-rvui-field', 'blocks.0.title');
    el.textContent = 'Old';
    document.body.appendChild(el);
    el.click();

    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: RVUI_CLICK,
        doc: 'page-1',
        field: 'blocks.0.title',
        currentValue: 'Old',
      }),
      ADMIN_ORIGIN,
    );
  });

  it('prevents default on an annotated link click so the preview stays on the page', async () => {
    editUrl();
    mockPreview(draftDocs());
    handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft: () => {} });

    const el = document.createElement('a');
    el.setAttribute('href', '/products');
    el.setAttribute('data-rvui-doc', 'page-1');
    el.setAttribute('data-rvui-field', 'blocks.0.data.links.0.href');
    el.textContent = 'See products';
    document.body.appendChild(el);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: RVUI_CLICK,
        field: 'blocks.0.data.links.0.href',
      }),
      ADMIN_ORIGIN,
    );
  });

  it('does not post a click for an unannotated element', async () => {
    editUrl();
    mockPreview(draftDocs());
    handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft: () => {} });
    postSpy.mockClear();

    const el = document.createElement('p');
    el.textContent = 'plain';
    document.body.appendChild(el);
    el.click();

    expect(postSpy).not.toHaveBeenCalled();
  });

  it('applies an inbound apply-patch from the admin origin and acks', async () => {
    editUrl();
    mockPreview(draftDocs());
    const onDraft = vi.fn();
    handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft });
    onDraft.mockClear();
    postSpy.mockClear();

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: ADMIN_ORIGIN,
        data: { type: RVUI_APPLY_PATCH, doc: 'page-1', field: 'blocks.0.title', value: 'New' },
      }),
    );

    expect(onDraft).toHaveBeenCalledWith([
      { docType: 'page', docId: 'page-1', draft: { blocks: [{ title: 'New' }] } },
    ]);
    expect(postSpy).toHaveBeenCalledWith(
      { type: RVUI_PATCH_APPLIED, doc: 'page-1', field: 'blocks.0.title' },
      ADMIN_ORIGIN,
    );
  });

  it('drops a message from a foreign origin', async () => {
    editUrl();
    mockPreview(draftDocs());
    const onDraft = vi.fn();
    handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft });
    onDraft.mockClear();
    postSpy.mockClear();

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: FOREIGN_ORIGIN,
        data: { type: RVUI_APPLY_PATCH, doc: 'page-1', field: 'blocks.0.title', value: 'Hacked' },
      }),
    );

    expect(onDraft).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('drops a malformed message from the admin origin', async () => {
    editUrl();
    mockPreview(draftDocs());
    const onDraft = vi.fn();
    handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft });
    onDraft.mockClear();
    postSpy.mockClear();

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: ADMIN_ORIGIN,
        data: { type: RVUI_APPLY_PATCH, doc: 'page-1' /* missing field + value */ },
      }),
    );

    expect(onDraft).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  // A fresh session's initial preview payload carries `docs: []` (the session
  // server only materializes a doc on its first field PATCH). The FIRST
  // apply-patch for a page always targets a docId the runtime hasn't seen yet.
  describe('apply-patch for a doc absent from the initial payload', () => {
    function emptyPreviewResponse() {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { siteId: 'site-1', adminOrigin: ADMIN_ORIGIN, docs: [] },
        }),
      };
    }

    function previewResponseWith(docs: PreviewDoc[]) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { siteId: 'site-1', adminOrigin: ADMIN_ORIGIN, docs },
        }),
      };
    }

    it('re-fetches the preview payload, applies the patch, and acks', async () => {
      editUrl();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(emptyPreviewResponse())
        .mockResolvedValueOnce(
          previewResponseWith([
            { docType: 'page', docId: 'page-1', draft: { blocks: [{ title: 'Old' }] } },
          ]),
        );
      vi.stubGlobal('fetch', fetchMock);

      const onDraft = vi.fn();
      handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft });
      onDraft.mockClear();
      postSpy.mockClear();

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ADMIN_ORIGIN,
          data: { type: RVUI_APPLY_PATCH, doc: 'page-1', field: 'blocks.0.title', value: 'New' },
        }),
      );

      await vi.waitFor(() => {
        expect(onDraft).toHaveBeenCalledWith([
          { docType: 'page', docId: 'page-1', draft: { blocks: [{ title: 'New' }] } },
        ]);
      });
      expect(postSpy).toHaveBeenCalledWith(
        { type: RVUI_PATCH_APPLIED, doc: 'page-1', field: 'blocks.0.title' },
        ADMIN_ORIGIN,
      );
      // One refetch beyond the initial preview fetch  -  not zero (dropped) and
      // not per-message.
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('shares a single refetch across concurrent misses and applies both patches', async () => {
      editUrl();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(emptyPreviewResponse())
        .mockResolvedValueOnce(
          previewResponseWith([
            {
              docType: 'page',
              docId: 'page-1',
              draft: { blocks: [{ title: 'Old', body: 'Old body' }] },
            },
          ]),
        );
      vi.stubGlobal('fetch', fetchMock);

      const onDraft = vi.fn();
      handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft });
      onDraft.mockClear();

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ADMIN_ORIGIN,
          data: {
            type: RVUI_APPLY_PATCH,
            doc: 'page-1',
            field: 'blocks.0.title',
            value: 'New title',
          },
        }),
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ADMIN_ORIGIN,
          data: {
            type: RVUI_APPLY_PATCH,
            doc: 'page-1',
            field: 'blocks.0.body',
            value: 'New body',
          },
        }),
      );

      await vi.waitFor(() => {
        expect(onDraft).toHaveBeenCalledWith([
          {
            docType: 'page',
            docId: 'page-1',
            draft: { blocks: [{ title: 'New title', body: 'New body' }] },
          },
        ]);
      });
      // Initial preview fetch + exactly ONE shared refetch, not one per miss.
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('drops the patch (fail-quiet) when the doc is still unknown after the refetch', async () => {
      editUrl();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(emptyPreviewResponse())
        .mockResolvedValueOnce(emptyPreviewResponse());
      vi.stubGlobal('fetch', fetchMock);

      const onDraft = vi.fn();
      handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft });
      onDraft.mockClear();
      postSpy.mockClear();

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ADMIN_ORIGIN,
          data: { type: RVUI_APPLY_PATCH, doc: 'page-1', field: 'blocks.0.title', value: 'New' },
        }),
      );

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(onDraft).not.toHaveBeenCalled();
      expect(postSpy).not.toHaveBeenCalled();
    });

    it('drops the patch (fail-quiet) when the refetch itself fails', async () => {
      editUrl();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(emptyPreviewResponse())
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
      vi.stubGlobal('fetch', fetchMock);

      const onDraft = vi.fn();
      handle = await initEditRuntime({ apiBaseUrl: API_BASE, onDraft });
      onDraft.mockClear();
      postSpy.mockClear();

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ADMIN_ORIGIN,
          data: { type: RVUI_APPLY_PATCH, doc: 'page-1', field: 'blocks.0.title', value: 'New' },
        }),
      );

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(onDraft).not.toHaveBeenCalled();
      expect(postSpy).not.toHaveBeenCalled();
    });
  });
});
