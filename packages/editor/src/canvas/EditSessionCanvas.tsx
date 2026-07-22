/**
 * EditSessionCanvas  -  the dashboard-side visual editor.
 *
 * Hosts the previewed marketing site in an iframe, listens for edit intents from
 * the in-iframe runtime over an EXACT-origin-pinned postMessage channel, and
 * drives field edits back through the authenticated session API.
 *
 * This is a Client Component. It must be mounted from a `'use client'` boundary
 * (the admin route does this); it takes no `next/*` dependency.
 *
 * Data flow:
 *   mount        -> POST /preview-token (cookie auth) -> iframe src = previewUrl
 *   rvui:click   -> open the field editor popover
 *   commit/type  -> PATCH the session doc (debounced autosave ~600ms) ->
 *                   postMessage rvui:apply-patch into the iframe for optimistic
 *                   re-render
 *   publish/discard -> session API; per-doc 409 conflicts surfaced as plain text
 */

import { Button, cn } from '@revealui/presentation';
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { type ClickMessage, isClickMessage, RVUI_APPLY_PATCH } from '../protocol.js';

const BREAKPOINTS = {
  desktop: { label: 'Desktop', width: 1280 },
  tablet: { label: 'Tablet', width: 768 },
  mobile: { label: 'Mobile', width: 375 },
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

const AUTOSAVE_DEBOUNCE_MS = 600;

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface EditSessionCanvasProps {
  sessionId: string;
  /** Base URL of the RevealUI API server, e.g. `https://api.revealui.com`. */
  apiBaseUrl: string;
  /**
   * Authenticated fetch. The admin mount passes its CSRF-aware `apiFetch`; falls
   * back to the global `fetch` (still credentialed) when omitted.
   */
  fetcher?: Fetcher;
}

interface SessionDoc {
  id: string;
  docId: string;
  docType: string;
  draft?: { blocks?: unknown[] };
}

interface BlockMeta {
  index: number;
  type: string;
  id: string;
}

function blockMetaFromDocs(docs: SessionDoc[], pageId: string | null): BlockMeta[] {
  if (!pageId) return [];
  const doc = docs.find((d) => d.docType === 'page' && d.docId === pageId);
  const blocks = doc?.draft?.blocks;
  if (!Array.isArray(blocks)) return [];
  const out: BlockMeta[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const raw = blocks[i];
    if (typeof raw !== 'object' || raw === null) continue;
    const rec = raw as Record<string, unknown>;
    const type = typeof rec.type === 'string' ? rec.type : 'unknown';
    const id = typeof rec.id === 'string' ? rec.id : `idx-${i}`;
    out.push({ index: i, type, id });
  }
  return out;
}

interface PreviewPageCandidate {
  id: string;
  slug: string;
}

/**
 * Choose which published page a fresh (empty) session should land the iframe on.
 * Prefers the VES marketing slice (`home`, then `products`, then `philosophy`,
 * then `local-ai`), else the first published page. Pure helper so canvas tests
 * can lock the order.
 */
export function pickDefaultPreviewPageId(
  pages: readonly PreviewPageCandidate[],
): string | undefined {
  if (pages.length === 0) return undefined;
  const bySlug = (slug: string): string | undefined => pages.find((p) => p.slug === slug)?.id;
  return (
    bySlug('home') ??
    bySlug('products') ??
    bySlug('philosophy') ??
    bySlug('local-ai') ??
    pages[0]?.id
  );
}

interface ActiveField {
  doc: string;
  field: string;
  rect: ClickMessage['rect'];
  value: string;
}

// -----------------------------------------------------------------------------
// Field editor popover
// -----------------------------------------------------------------------------

interface FieldEditorPopoverProps {
  field: ActiveField;
  onCommit: (value: string) => void;
  onClose: () => void;
}

function FieldEditorPopover({ field, onCommit, onClose }: FieldEditorPopoverProps): ReactElement {
  const [value, setValue] = useState(field.value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const scheduleAutosave = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => onCommit(next), AUTOSAVE_DEBOUNCE_MS);
    },
    [onCommit],
  );

  const flushAndClose = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    onCommit(value);
    onClose();
  }, [onCommit, onClose, value]);

  return (
    <div
      role="dialog"
      aria-label="Edit field"
      className="fixed z-50 rounded-md border border-neutral-700 bg-neutral-900 p-2 shadow-lg"
      style={{
        top: Math.max(field.rect.top + field.rect.height + 4, 0),
        left: Math.max(field.rect.left, 0),
        minWidth: 240,
      }}
    >
      <textarea
        aria-label="Field value"
        className="block w-full resize-y rounded border border-neutral-600 bg-neutral-800 p-1 text-sm text-neutral-100"
        rows={3}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          scheduleAutosave(e.target.value);
        }}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" appearance="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={flushAndClose}>
          Save
        </Button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Canvas
// -----------------------------------------------------------------------------

export function EditSessionCanvas({
  sessionId,
  apiBaseUrl,
  fetcher,
}: EditSessionCanvasProps): ReactElement {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [marketingOrigin, setMarketingOrigin] = useState<string | null>(null);
  const [docs, setDocs] = useState<SessionDoc[]>([]);
  const [previewPageId, setPreviewPageId] = useState<string | null>(null);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');
  const [activeField, setActiveField] = useState<ActiveField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const doFetch = useCallback<Fetcher>(
    (path, init = {}) => {
      const url = path.startsWith('http') ? path : `${apiBaseUrl}${path}`;
      const f = fetcher ?? fetch;
      return f(url, { credentials: 'include', ...init });
    },
    [apiBaseUrl, fetcher],
  );

  // Mount: read session detail (dirty-doc list) then mint a preview token.
  // When the session has no overlays yet (brand-new open), resolve a default
  // published page on the session's site (home → products → first) so the
  // iframe does not land on bare `/` with nothing annotated.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detailRes = await doFetch(`/api/content/sessions/${sessionId}`);
        if (!detailRes.ok) throw new Error(`session load failed: ${detailRes.status}`);
        const detail = (await detailRes.json()) as {
          data: {
            session: { siteId: string };
            docs: SessionDoc[];
          };
        };
        const dirtyPage = detail.data.docs.find((d) => d.docType === 'page');
        let pageId = dirtyPage?.docId;

        if (!pageId && detail.data.session.siteId) {
          const pagesRes = await doFetch(
            `/api/content/sites/${detail.data.session.siteId}/pages?status=published`,
          );
          if (pagesRes.ok) {
            const pagesBody = (await pagesRes.json()) as {
              data: PreviewPageCandidate[];
            };
            pageId = pickDefaultPreviewPageId(pagesBody.data ?? []);
          }
        }

        const query = pageId ? `?pageId=${encodeURIComponent(pageId)}` : '';
        const mintRes = await doFetch(`/api/content/sessions/${sessionId}/preview-token${query}`, {
          method: 'POST',
        });
        if (!mintRes.ok) throw new Error(`preview token failed: ${mintRes.status}`);
        const mint = (await mintRes.json()) as { data: { previewUrl: string } };
        if (cancelled) return;
        setDocs(detail.data.docs);
        if (pageId) setPreviewPageId(pageId);
        setPreviewUrl(mint.data.previewUrl);
        setMarketingOrigin(new URL(mint.data.previewUrl).origin);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doFetch, sessionId]);

  // Origin-pinned inbound channel: only clicks from the preview origin open the editor.
  useEffect(() => {
    if (!marketingOrigin) return;
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== marketingOrigin) return;
      if (!isClickMessage(event.data)) return;
      setPreviewPageId(event.data.doc);
      setActiveField({
        doc: event.data.doc,
        field: event.data.field,
        rect: event.data.rect,
        value: event.data.currentValue,
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [marketingOrigin]);

  const refreshDocs = useCallback(async () => {
    const res = await doFetch(`/api/content/sessions/${sessionId}`);
    if (!res.ok) return;
    const detail = (await res.json()) as { data: { docs: SessionDoc[] } };
    setDocs(detail.data.docs);
  }, [doFetch, sessionId]);

  const targetDocId = previewPageId ?? docs.find((d) => d.docType === 'page')?.docId ?? null;
  const blockList = blockMetaFromDocs(docs, targetDocId);

  const commitPatch = useCallback(
    async (doc: string, field: string, value: string) => {
      setNotice(null);
      const res = await doFetch(`/api/content/sessions/${sessionId}/docs/page/${doc}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: field, value }),
      });
      if (res.status === 422) {
        setNotice('Voice rules rejected this edit. Adjust the copy and try again.');
        return;
      }
      if (!res.ok) {
        setNotice(`Could not save this field (${res.status}).`);
        return;
      }
      // Optimistic re-render inside the preview iframe.
      if (marketingOrigin) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: RVUI_APPLY_PATCH, doc, field, value },
          marketingOrigin,
        );
      }
      await refreshDocs();
    },
    [doFetch, marketingOrigin, refreshDocs, sessionId],
  );

  const commitBlockOp = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!targetDocId) {
        setNotice('No page selected for block operations.');
        return;
      }
      setNotice(null);
      const res = await doFetch(`/api/content/sessions/${sessionId}/docs/page/${targetDocId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 422) {
        setNotice('Voice rules rejected this block change.');
        return;
      }
      if (!res.ok) {
        setNotice(`Block operation failed (${res.status}).`);
        return;
      }
      setNotice('Blocks updated. Reload the preview to see structure changes.');
      await refreshDocs();
    },
    [doFetch, refreshDocs, sessionId, targetDocId],
  );

  const publish = useCallback(async () => {
    setNotice(null);
    const res = await doFetch(`/api/content/sessions/${sessionId}/publish`, { method: 'POST' });
    const body = (await res.json()) as {
      partiallyPublished?: string[];
      conflicts?: unknown[];
    };
    if (res.ok) {
      setNotice('Published.');
      await refreshDocs();
      return;
    }
    if (res.status === 409) {
      const stuck = body.partiallyPublished?.length
        ? ` Some pages stayed live and need a retry: ${body.partiallyPublished.join(', ')}.`
        : '';
      setNotice(`Publish blocked by a version conflict.${stuck}`);
      return;
    }
    setNotice(`Publish failed (${res.status}).`);
  }, [doFetch, refreshDocs, sessionId]);

  const discard = useCallback(async () => {
    setNotice(null);
    const res = await doFetch(`/api/content/sessions/${sessionId}/discard`, { method: 'POST' });
    setNotice(res.ok ? 'Session discarded.' : `Discard failed (${res.status}).`);
  }, [doFetch, sessionId]);

  const width = BREAKPOINTS[breakpoint].width;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="m-0 flex gap-1 border-0 p-0">
          <legend className="sr-only">Preview width</legend>
          {(Object.keys(BREAKPOINTS) as Breakpoint[]).map((key) => (
            <Button
              key={key}
              size="sm"
              appearance={key === breakpoint ? 'solid' : 'outline'}
              aria-pressed={key === breakpoint}
              onClick={() => setBreakpoint(key)}
            >
              {BREAKPOINTS[key].label}
            </Button>
          ))}
        </fieldset>
        <div className="ml-auto flex gap-2">
          <Button size="sm" appearance="outline" onClick={discard}>
            Discard
          </Button>
          <Button size="sm" onClick={publish}>
            Publish
          </Button>
        </div>
      </div>

      {notice ? (
        <p role="status" className="text-sm text-amber-400">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="w-64 shrink-0 overflow-auto rounded-md border border-neutral-800 p-2">
          <h2 className="mb-2 text-xs font-semibold uppercase text-neutral-400">Changed docs</h2>
          {docs.length === 0 ? (
            <p className="mb-3 text-sm text-neutral-500">No edits yet.</p>
          ) : (
            <ul className="mb-3 space-y-1">
              {docs.map((d) => (
                <li key={d.id} className="truncate text-sm text-neutral-200">
                  {d.docType}: {d.docId}
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-2 text-xs font-semibold uppercase text-neutral-400">Blocks</h2>
          {blockList.length === 0 ? (
            <p className="mb-2 text-sm text-neutral-500">
              Edit a field first, or add a text block, to materialize the draft.
            </p>
          ) : (
            <ul className="mb-2 space-y-2">
              {blockList.map((b) => (
                <li
                  key={`${b.id}-${b.index}`}
                  className="rounded border border-neutral-800 p-1.5 text-xs text-neutral-200"
                >
                  <div className="mb-1 truncate font-medium">
                    {b.index}. {b.type}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      appearance="outline"
                      disabled={b.index === 0}
                      onClick={() =>
                        void commitBlockOp({ op: 'blocks.move', from: b.index, to: b.index - 1 })
                      }
                    >
                      Up
                    </Button>
                    <Button
                      size="sm"
                      appearance="outline"
                      disabled={b.index >= blockList.length - 1}
                      onClick={() =>
                        void commitBlockOp({ op: 'blocks.move', from: b.index, to: b.index + 1 })
                      }
                    >
                      Down
                    </Button>
                    <Button
                      size="sm"
                      appearance="outline"
                      variant="danger"
                      disabled={blockList.length <= 1}
                      onClick={() => void commitBlockOp({ op: 'blocks.remove', index: b.index })}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Button
            size="sm"
            appearance="outline"
            disabled={!targetDocId}
            onClick={() =>
              void commitBlockOp({
                op: 'blocks.insert',
                index: blockList.length,
                block: {
                  id: `text-${crypto.randomUUID()}`,
                  type: 'text',
                  data: { content: 'New text block' },
                },
              })
            }
          >
            Add text block
          </Button>
        </aside>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-neutral-800 bg-neutral-950">
          {previewUrl ? (
            <iframe
              ref={iframeRef}
              title="Content preview"
              src={previewUrl}
              className={cn('mx-auto block h-full border-0 bg-white')}
              style={{ width }}
            />
          ) : (
            <p className="p-4 text-sm text-neutral-500">Loading preview...</p>
          )}
        </div>
      </div>

      {activeField ? (
        <FieldEditorPopover
          field={activeField}
          onCommit={(value) => commitPatch(activeField.doc, activeField.field, value)}
          onClose={() => setActiveField(null)}
        />
      ) : null}
    </div>
  );
}
