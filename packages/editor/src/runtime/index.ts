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
 *
 * A doc can be targeted by `rvui:apply-patch` before it exists in the local
 * `docs` array: a fresh session's initial preview fetch returns `docs: []`
 * (the session server only materializes a doc on its first field PATCH), so
 * the FIRST patch to a page always targets a docId the runtime hasn't seen
 * yet. On that miss, the runtime re-fetches the preview payload once (shared
 * across any concurrent misses, see `ensureDocsRefetched`) to pick up the
 * newly materialized doc, then retries the patch instead of dropping it.
 */

import {
  type ApplyPatchMessage,
  devWarn,
  isApplyPatchMessage,
  isSetThemeMessage,
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

/**
 * Path segments are identifiers or decimal array indices only. This blocks
 * prototype pollution (`__proto__` / `constructor` / `prototype`) and any
 * non-identifier injection without relying on a denylist alone (CodeQL
 * `js/prototype-pollution-utility`).
 */
function isSafePathSegment(segment: string): boolean {
  if (segment.length === 0 || DANGEROUS_KEYS.has(segment)) return false;
  for (let i = 0; i < segment.length; i++) {
    const code = segment.charCodeAt(i);
    const isDigit = code >= 48 && code <= 57;
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;
    const isUnder = code === 95;
    if (!(isDigit || isUpper || isLower || isUnder)) return false;
  }
  return true;
}

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
    if (!isSafePathSegment(segment)) {
      devWarn(`ignored patch with illegal path segment: ${path}`);
      return;
    }
  }
  let cursor: Record<string, unknown> | unknown[] = draft;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (segment === undefined) return;
    let next: unknown;
    if (Array.isArray(cursor)) {
      if (!isArrayIndex(segment)) {
        devWarn(`patch target path does not exist: ${path}`);
        return;
      }
      next = cursor[Number(segment)];
    } else if (Object.hasOwn(cursor, segment)) {
      next = cursor[segment];
    } else {
      devWarn(`patch target path does not exist: ${path}`);
      return;
    }
    if (next === null || typeof next !== 'object') {
      devWarn(`patch target path does not exist: ${path}`);
      return;
    }
    cursor = next as Record<string, unknown> | unknown[];
  }
  const last = segments[segments.length - 1];
  if (last === undefined || !isSafePathSegment(last)) return;
  if (Array.isArray(cursor)) {
    if (!isArrayIndex(last)) return;
    cursor[Number(last)] = value;
  } else {
    // Own-property write only after segment allowlist (no __proto__ chain).
    Object.defineProperty(cursor, last, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
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
 * Session ids are server-minted UUIDs. Restrict path segments so URL query
 * values cannot rewrite the request path (CodeQL `js/client-side-request-forgery`).
 */
const SAFE_SESSION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Preview tokens are `base64url(payload).base64url(sig)` — no `/`, `\`, or `..`.
 * See apps/server/src/routes/content/_helpers/preview-token.ts.
 */
const SAFE_PREVIEW_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function isSafeSessionId(value: string): boolean {
  return SAFE_SESSION_ID.test(value);
}

function isSafePreviewToken(value: string): boolean {
  return value.length <= 4096 && SAFE_PREVIEW_TOKEN.test(value);
}

/**
 * Fetch + validate the session's read-only preview payload. Returns `null` on
 * any transport error, non-OK response, or shape mismatch (never throws).
 *
 * `sessionId` and `token` MUST already pass {@link isSafeSessionId} /
 * {@link isSafePreviewToken} so the pathname cannot be attacker-controlled.
 */
async function fetchPreviewPayload(
  apiBaseUrl: string,
  sessionId: string,
  token: string,
): Promise<Required<PreviewResponse>['data'] | null> {
  try {
    // Pathname is built only from allowlisted session ids (UUID). Token goes
    // in the query string via URLSearchParams (encoded), never in the path.
    const url = new URL(
      `/api/content/sessions/${encodeURIComponent(sessionId)}/preview`,
      apiBaseUrl,
    );
    url.searchParams.set('token', token);
    const res = await fetch(url.href, { credentials: 'omit' });
    if (!res.ok) {
      devWarn(`preview fetch failed: ${res.status}`);
      return null;
    }
    const body: unknown = await res.json();
    if (!isValidPayload(body)) {
      devWarn('preview payload malformed');
      return null;
    }
    return body.data;
  } catch (err) {
    devWarn(`preview fetch threw: ${String(err)}`);
    return null;
  }
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
  if (!(isSafeSessionId(sessionId) && isSafePreviewToken(token))) {
    devWarn('ignored edit-mode params with illegal session id or preview token shape');
    return null;
  }

  const payload = await fetchPreviewPayload(config.apiBaseUrl, sessionId, token);
  if (!payload) return null;

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

  // Shared in-flight refetch: concurrent apply-patch misses for the same (or
  // different) unknown docIds await the SAME promise rather than each firing
  // their own request, and each resumes independently once it resolves, so no
  // patch is lost and no doc miss triggers more than one network round trip.
  let refetchInFlight: Promise<void> | null = null;

  const ensureDocsRefetched = (): Promise<void> => {
    if (!refetchInFlight) {
      refetchInFlight = fetchPreviewPayload(config.apiBaseUrl, sessionId, token)
        .then((refetched) => {
          if (!refetched) return;
          for (const doc of refetched.docs) {
            if (!docs.some((d) => d.docId === doc.docId)) {
              docs.push(doc);
            }
          }
        })
        .finally(() => {
          refetchInFlight = null;
        });
    }
    return refetchInFlight;
  };

  const applyPatch = async (msg: ApplyPatchMessage): Promise<void> => {
    let target = docs.find((d) => d.docId === msg.doc);
    if (!target) {
      // Not yet known locally: the session server may have just materialized
      // this doc off its first patch. Refetch once, then retry the lookup.
      await ensureDocsRefetched();
      target = docs.find((d) => d.docId === msg.doc);
    }
    if (!target) {
      devWarn(`apply-patch for unknown doc: ${msg.doc}`);
      return;
    }
    setAtPath(target.draft, msg.field, msg.value);
    emitDraft();
    post({ type: RVUI_PATCH_APPLIED, doc: msg.doc, field: msg.field });
  };

  const applyThemeTokens = (tokens: Record<string, string>): void => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(tokens)) {
      // Only accept design-token names (D8); reject arbitrary CSS injection.
      if (!key.startsWith('--rvui-')) continue;
      if (value.includes(';') || value.includes('{') || value.includes('}')) continue;
      root.style.setProperty(key, value);
    }
  };

  const onMessage = (event: MessageEvent): void => {
    if (event.origin !== adminOrigin) {
      devWarn(`dropped message from foreign origin: ${event.origin}`);
      return;
    }
    if (isSetThemeMessage(event.data)) {
      applyThemeTokens(event.data.tokens);
      return;
    }
    if (!isApplyPatchMessage(event.data)) {
      devWarn('dropped malformed message');
      return;
    }
    void applyPatch(event.data);
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const el = target.closest('[data-rvui-field]');
    if (!el) return;
    const doc = el.getAttribute('data-rvui-doc');
    const field = el.getAttribute('data-rvui-field');
    if (!(doc && field)) return;
    // Stay on the previewed page: annotated CTAs would otherwise navigate
    // away before the canvas can open the field editor.
    event.preventDefault();
    event.stopPropagation();
    // Prefer attribute values for link/image fields so the canvas gets href/src.
    const attrValue =
      el.getAttribute('href') ??
      el.getAttribute('src') ??
      (el instanceof HTMLElement ? el.dataset.rvuiValue : null);
    post({
      type: RVUI_CLICK,
      doc,
      field,
      rect: rectOf(el),
      currentValue: attrValue ?? el.textContent ?? '',
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
