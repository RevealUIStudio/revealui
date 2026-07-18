/**
 * Edit-mode bootstrap for the marketing site.
 *
 * Zero cost when the `rvui-edit` param is absent: the @revealui/editor runtime
 * chunk is dynamically imported ONLY in edit mode, so a normal visitor never
 * pays for it. In edit mode it initializes the runtime with a callback that
 * stashes the draft overlays into a module-level store. Page components
 * subscribe to that store to render drafts; wiring that consumption into the
 * block renderer is a follow-up slice.
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

/**
 * Initialize edit mode if the URL carries an edit token. No-op (and no import)
 * otherwise, so a normal page load stays untouched.
 */
export function initEditMode(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.get('rvui-edit')) return;
  void import('@revealui/editor/runtime').then(({ initEditRuntime }) => {
    void initEditRuntime({ apiBaseUrl: API_URL, onDraft: setDrafts });
  });
}
