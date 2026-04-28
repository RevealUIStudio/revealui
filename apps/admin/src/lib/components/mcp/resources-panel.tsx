/**
 * Resources panel for `/mcp/inspect` (Stage 3.3).
 *
 * Lists resources advertised by a connected remote MCP server and, on row
 * click, fetches the contents via `readResource` and renders a read-only
 * preview pane. Text blocks render as monospace; binary blobs surface
 * their mime-type with a size chip.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

interface ResourcesPanelProps {
  tenant: string;
  server: string;
}

export function ResourcesPanel({ tenant, server }: ResourcesPanelProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [contents, setContents] = useState<ResourceContent[] | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadResources = useCallback(async () => {
    setState('loading');
    setMessage(null);
    try {
      const res = await fetch(
        `/api/mcp/remote-servers/${encodeURIComponent(server)}/resources?tenant=${encodeURIComponent(tenant)}`,
        { credentials: 'include' },
      );
      // empty-catch-ok: non-JSON error body — res.status surfaces below
      const body = (await res.json().catch(() => ({}))) as {
        resources?: Resource[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setResources(body.resources ?? []);
      setState('ready');
    } catch (err) {
      setState('error');
      setMessage(`Failed to load resources: ${(err as Error).message}`);
    }
  }, [tenant, server]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  const handleSelect = useCallback(
    async (uri: string) => {
      setSelectedUri(uri);
      setContents(null);
      setPreviewError(null);
      setPreviewState('loading');
      try {
        const res = await fetch(
          `/api/mcp/remote-servers/${encodeURIComponent(server)}/resource?tenant=${encodeURIComponent(tenant)}&uri=${encodeURIComponent(uri)}`,
          { credentials: 'include' },
        );
        // empty-catch-ok: non-JSON error body — res.status surfaces below
        const body = (await res.json().catch(() => ({}))) as {
          contents?: ResourceContent[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setContents(body.contents ?? []);
        setPreviewState('ready');
      } catch (err) {
        setPreviewError((err as Error).message);
        setPreviewState('error');
      }
    },
    [tenant, server],
  );

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div>
        {message && (
          <div
            role="alert"
            className="mb-3 rounded-lg border border-red-800 bg-red-900/20 p-3 text-xs text-red-300"
          >
            {message}
          </div>
        )}
        {state === 'loading' && (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-4 text-center text-xs text-zinc-500">
            Loading…
          </div>
        )}
        {state === 'ready' && resources.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-4 text-center text-xs text-zinc-500">
            No resources advertised.
          </div>
        )}
        {resources.length > 0 && (
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50">
            {resources.map((r) => {
              const selected = r.uri === selectedUri;
              return (
                <li key={r.uri}>
                  <button
                    type="button"
                    onClick={() => void handleSelect(r.uri)}
                    className={`block w-full px-3 py-2 text-left transition-colors ${
                      selected
                        ? 'bg-emerald-900/20 text-emerald-200'
                        : 'text-zinc-300 hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="truncate font-mono text-xs">{r.name || r.uri}</div>
                    <div className="mt-0.5 truncate text-[10px] text-zinc-500">{r.uri}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        {!selectedUri && (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center text-xs text-zinc-500">
            Select a resource to preview its contents.
          </div>
        )}
        {selectedUri && previewState === 'loading' && (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center text-xs text-zinc-500">
            Loading preview…
          </div>
        )}
        {selectedUri && previewState === 'error' && (
          <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-xs text-red-300">
            {previewError}
          </div>
        )}
        {selectedUri && previewState === 'ready' && contents && (
          <div className="space-y-3">
            <div className="rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2 font-mono text-[10px] text-zinc-500">
              {selectedUri}
            </div>
            {contents.length === 0 && (
              <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/30 p-3 text-center text-xs text-zinc-500">
                (empty)
              </div>
            )}
            {contents.map((block, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: content blocks have no id
              <div key={idx} className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="mb-2 text-[10px] text-zinc-500">
                  {block.mimeType ??
                    (block.text !== undefined ? 'text/plain' : 'application/octet-stream')}
                  {block.blob && ` · ${block.blob.length} base64 chars`}
                </div>
                {block.text !== undefined ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-zinc-200">
                    {block.text}
                  </pre>
                ) : (
                  <div className="font-mono text-[11px] text-zinc-500">
                    (binary content — not rendered in preview)
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
