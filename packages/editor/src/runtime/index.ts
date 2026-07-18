/**
 * Edit-mode runtime  -  loaded by the previewed site ONLY in edit mode.
 *
 * Dependency-free and framework-agnostic. It:
 *   1. reads `?rvui-edit=<token>&rvui-session=<id>` from the URL,
 *   2. fetches the read-only preview payload (draft overlays + the trusted
 *      dashboard origin) from the API,
 *   3. hands the drafts to the host page via a callback (the host decides how to
 *      render them  -  the runtime never touches innerHTML), and
 *   4. runs an EXACT-origin-pinned postMessage channel with the parent canvas:
 *      it accepts messages ONLY from the admin origin returned by the server
 *      (never from the URL) and posts ONLY to that origin.
 *
 * Click delegation reports edit intents (`rvui:click`); inbound `rvui:apply-patch`
 * updates the draft and re-invokes the host callback for optimistic re-render.
 */

import {
  type ApplyPatchMessage,
  devWarn,
  isApplyPatchMessage,
  RVUI_CLICK,
  RVUI_PATCH_APPLIED,
  RVUI_READY,
} from '../protocol.js';

export interface PreviewDoc {
  docType: string;
  docId: string;
  draft: Record<string, unknown>;
}

export interface EditRuntimeConfig {
  /** Base URL of the RevealUI API server, e.g. `https://api.revealui.com`. */
  apiBaseUrl: string;
  /** Called with the current draft overlays whenever they change (init + patches). */
  onDraft: (docs: PreviewDoc[]) => void;
}

export interface EditRuntimeHandle {
  /** Remove all listeners. Idempotent. */
  destroy: () => void;
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isArrayIndex(segment: string): boolean {
  if (segment.length === 0) return false;
  for (let i = 0; i < segment.length; i++) {
    const code = segment.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

/** Set `value` at a dot/array path inside a draft. Prototype-pollution guarded. */
function setAtPath(draft: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  for (const segment of segments) {
    if (segment.length === 0 || DANGEROUS_KEYS.has(segment)) {
      devWarn(`ignored patch with illegal path segment: ${path}`);
      return;
    }
  }
  let cursor: Record<string, unknown> | unknown[] = draft;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (segment === undefined) return;
    const next: unknown = Array.isArray(cursor)
      ? cursor[Number(segment)]
      : (cursor as Record<string, unknown>)[segment];
    if (next === null || typeof next !== 'object') {
      devWarn(`patch target path does not exist: ${path}`);
      return;
    }
    cursor = next as Record<string, unknown> | unknown[];
  }
  const last = segments[segments.length - 1];
  if (last === undefined) return;
  if (Array.isArray(cursor)) {
    if (!isArrayIndex(last)) return;
    cursor[Number(last)] = value;
  } else {
    (cursor as Record<string, unknown>)[last] = value;
  }
}

function rectOf(el: Element): { top: number; left: number; width: number; height: number } {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

interface PreviewResponse {
  success: boolean;
  data?: { siteId: string; adminOrigin: string; docs: PreviewDoc[] };
}

function isValidPayload(body: unknown): body is Required<PreviewResponse> {
  if (typeof body !== 'object' || body === null) return false;
  const data = (body as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return typeof d.adminOrigin === 'string' && d.adminOrigin.length > 0 && Array.isArray(d.docs);
}

/**
 * Initialize the edit-mode runtime. Returns a handle, or `null` when the URL
 * carries no edit token (not edit mode) or the preview fetch fails.
 */
export async function initEditRuntime(
  config: EditRuntimeConfig,
): Promise<EditRuntimeHandle | null> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('rvui-edit');
  const sessionId = params.get('rvui-session');
  if (!(token && sessionId)) {
    return null;
  }

  let payload: Required<PreviewResponse>['data'];
  try {
    const url = new URL(`/api/content/sessions/${sessionId}/preview`, config.apiBaseUrl);
    url.searchParams.set('token', token);
    const res = await fetch(url.toString(), { credentials: 'omit' });
    if (!res.ok) {
      devWarn(`preview fetch failed: ${res.status}`);
      return null;
    }
    const body: unknown = await res.json();
    if (!isValidPayload(body)) {
      devWarn('preview payload malformed');
      return null;
    }
    payload = body.data;
  } catch (err) {
    devWarn(`preview fetch threw: ${String(err)}`);
    return null;
  }

  // The one trusted origin. Comes from the server config in the payload, NEVER
  // from the URL or from any received message.
  const adminOrigin = payload.adminOrigin;
  const docs: PreviewDoc[] = payload.docs;

  const post = (message: unknown): void => {
    window.parent.postMessage(message, adminOrigin);
  };

  const emitDraft = (): void => {
    config.onDraft(docs.map((d) => ({ ...d, draft: d.draft })));
  };

  const onMessage = (event: MessageEvent): void => {
    if (event.origin !== adminOrigin) {
      devWarn(`dropped message from foreign origin: ${event.origin}`);
      return;
    }
    if (!isApplyPatchMessage(event.data)) {
      devWarn('dropped malformed message');
      return;
    }
    const msg: ApplyPatchMessage = event.data;
    const target = docs.find((d) => d.docId === msg.doc);
    if (!target) {
      devWarn(`apply-patch for unknown doc: ${msg.doc}`);
      return;
    }
    setAtPath(target.draft, msg.field, msg.value);
    emitDraft();
    post({ type: RVUI_PATCH_APPLIED, doc: msg.doc, field: msg.field });
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const el = target.closest('[data-rvui-field]');
    if (!el) return;
    const doc = el.getAttribute('data-rvui-doc');
    const field = el.getAttribute('data-rvui-field');
    if (!(doc && field)) return;
    post({
      type: RVUI_CLICK,
      doc,
      field,
      rect: rectOf(el),
      currentValue: el.textContent ?? '',
    });
  };

  window.addEventListener('message', onMessage);
  document.addEventListener('click', onClick, true);

  // Hand the host the initial drafts, then announce readiness.
  emitDraft();
  post({ type: RVUI_READY });

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', onClick, true);
    },
  };
}
