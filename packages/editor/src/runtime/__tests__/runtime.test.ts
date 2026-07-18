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
  window.history.pushState({}, '', '/?rvui-edit=tok&rvui-session=sid');
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
});
