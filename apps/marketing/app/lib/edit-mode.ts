/**
 * Edit-mode bootstrap for the marketing site.
 *
 * Zero cost when the `rvui-edit` param is absent: the @revealui/editor runtime
 * chunk is dynamically imported ONLY in edit mode, so a normal visitor never
 * pays for it. In edit mode it initializes the runtime with a callback that
 * stashes the draft overlays into a module-level store. Page components
 * (`../use-page-blocks.ts`) subscribe to that store to render drafts and
 * derive the click-to-edit annotation.
 *
 * The store follows the in-repo `useSyncExternalStore` shape (subscribe +
 * getSnapshot), matching @revealui/router.
 */

import type { PreviewDoc } from '@revealui/editor/runtime';

type Listener = () => void;

let currentDrafts: PreviewDoc[] = [];
const listeners = new Set<Listener>();

/** Subscribe to draft-overlay changes. Returns an unsubscribe function. */
export function subscribeEditDrafts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current draft overlays. Stable reference until the drafts change. */
export function getEditDrafts(): PreviewDoc[] {
  return currentDrafts;
}

function setDrafts(docs: PreviewDoc[]): void {
  currentDrafts = docs;
  for (const listener of listeners) {
    listener();
  }
}

const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? 'https://api.revealui.com' : 'http://localhost:3004');

export const EDIT_QUERY_PARAM = 'rvui-edit';
export const SESSION_QUERY_PARAM = 'rvui-session';

/**
 * True when the URL carries an edit-mode token. Synchronous and independent of
 * the runtime/draft-fetch lifecycle, so callers can activate edit-mode UI (e.g.
 * click-to-edit annotations) on first render, before `initEditRuntime` resolves
 * and before any draft overlay exists.
 */
export function isEditModeActive(): boolean {
  return new URLSearchParams(window.location.search).has(EDIT_QUERY_PARAM);
}

/**
 * Copy the live-edit query params onto a same-site navigation target so the
 * iframe can move between home / products without dropping the preview token.
 * Hash-only, mailto, and non-http(s) targets are returned unchanged.
 */
export function preserveEditModeUrl(target: string, currentSearch: string): string {
  const current = new URLSearchParams(
    currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch,
  );
  const token = current.get(EDIT_QUERY_PARAM);
  const sessionId = current.get(SESSION_QUERY_PARAM);
  if (!(token && sessionId)) return target;
  if (target.startsWith('#') || target.startsWith('mailto:') || target.startsWith('javascript:')) {
    return target;
  }

  let url: URL;
  try {
    url =
      target.startsWith('http://') || target.startsWith('https://')
        ? new URL(target)
        : new URL(target, 'https://revealui.invalid');
  } catch {
    return target;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return target;

  url.searchParams.set(EDIT_QUERY_PARAM, token);
  url.searchParams.set(SESSION_QUERY_PARAM, sessionId);
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return url.toString();
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function isSameOriginHistoryUrl(url: string): boolean {
  if (url.startsWith('/') || url.startsWith('?') || url.startsWith('#')) return true;
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Keep `rvui-edit` / `rvui-session` on in-iframe navigations:
 *   - history.pushState / replaceState (covers @revealui/router Link)
 *   - click on same-origin `<a href>` (covers footer and raw anchors)
 *
 * Returns an uninstall function. No-op when the current URL has no edit token.
 */
export function installEditModeNavigation(): () => void {
  if (typeof window === 'undefined') {
    return () => {
      /* no window to unwrap */
    };
  }
  const search = window.location.search;
  if (!new URLSearchParams(search).has(EDIT_QUERY_PARAM)) {
    return () => {
      /* edit token absent — nothing installed */
    };
  }

  const historyObj = window.history;
  const originalPush = historyObj.pushState.bind(historyObj);
  const originalReplace = historyObj.replaceState.bind(historyObj);

  const wrap =
    (original: typeof historyObj.pushState) =>
    (data: unknown, unused: string, url?: string | URL | null): void => {
      if (typeof url === 'string' && isSameOriginHistoryUrl(url)) {
        original.call(historyObj, data, unused, preserveEditModeUrl(url, search));
        return;
      }
      if (url instanceof URL && url.origin === window.location.origin) {
        original.call(
          historyObj,
          data,
          unused,
          preserveEditModeUrl(`${url.pathname}${url.search}${url.hash}`, search),
        );
        return;
      }
      original.call(historyObj, data, unused, url);
    };

  historyObj.pushState = wrap(originalPush);
  historyObj.replaceState = wrap(originalReplace);

  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!(href && isSameOriginHistoryUrl(href))) return;
    const next = preserveEditModeUrl(href, search);
    if (next !== href) anchor.setAttribute('href', next);
  };
  document.addEventListener('click', onClick, true);

  document.documentElement.dataset.rvuiEditMode = 'true';

  return () => {
    historyObj.pushState = originalPush;
    historyObj.replaceState = originalReplace;
    document.removeEventListener('click', onClick, true);
    delete document.documentElement.dataset.rvuiEditMode;
  };
}

/**
 * Initialize edit mode if the URL carries an edit token. No-op (and no import)
 * otherwise, so a normal page load stays untouched.
 */
export function initEditMode(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.get(EDIT_QUERY_PARAM)) return;
  installEditModeNavigation();
  void import('@revealui/editor/runtime').then(({ initEditRuntime }) => {
    void initEditRuntime({ apiBaseUrl: API_URL, onDraft: setDrafts });
  });
}
