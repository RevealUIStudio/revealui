/**
 * MCP — Server Catalog + Usage (/admin/mcp)
 *
 * Tabbed page:
 *   - Catalog (Stage 3.1) — built-in servers, content exposure, and
 *     OAuth-authorized remote servers for the selected tenant.
 *   - Usage (A.3 of the post-v1 MCP arc) — per-`meterName` call counts
 *     and p50/p95 durations from `usage_meters`, served by
 *     `/api/mcp/usage`.
 *
 * Tool/resource/prompt browsing lives at `/mcp/inspect`.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { McpServerCard, type McpServerInfo } from '@/lib/components/agents/mcp-server-card';
import { UsageDashboard } from '@/lib/components/mcp/usage-dashboard';
import type { CollectionMcpSummary } from '@/lib/mcp/collections';

interface RemoteServerSummary {
  tenant: string;
  server: string;
  connectionState: 'connected';
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type CatalogTab = 'catalog' | 'usage';

export default function McpCatalogPage() {
  const [activeTab, setActiveTab] = useState<CatalogTab>('catalog');
  const [tenant, setTenant] = useState<string>('');
  const [activeTenant, setActiveTenant] = useState<string | null>(null);
  const [builtins, setBuiltins] = useState<McpServerInfo[]>([]);
  const [remotes, setRemotes] = useState<RemoteServerSummary[]>([]);
  const [collections, setCollections] = useState<CollectionMcpSummary[]>([]);
  const [state, setState] = useState<LoadState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  // Load built-in servers on mount (tenant-agnostic).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/mcp/servers', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { servers: McpServerInfo[] };
        if (!cancelled) setBuiltins(data.servers ?? []);
      } catch (err) {
        if (!cancelled) setMessage(`Failed to load built-in servers: ${(err as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load MCP content-exposure map on mount (tenant-agnostic in v1).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/mcp/collections', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { collections: CollectionMcpSummary[] };
        if (!cancelled) setCollections(data.collections ?? []);
      } catch (err) {
        if (!cancelled) {
          setMessage(`Failed to load collection exposure: ${(err as Error).message}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRemotes = useCallback(async (tenantId: string) => {
    setState('loading');
    setMessage(null);
    try {
      const res = await fetch(`/api/mcp/remote-servers?tenant=${encodeURIComponent(tenantId)}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }; // empty-catch-ok: non-JSON error body — res.status is surfaced below
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { servers: RemoteServerSummary[] };
      setRemotes(data.servers ?? []);
      setState('ready');
    } catch (err) {
      setState('error');
      setMessage(`Failed to load remote servers: ${(err as Error).message}`);
    }
  }, []);

  const handleLoadTenant = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tenant.trim();
    if (!trimmed) return;
    setActiveTenant(trimmed);
    void loadRemotes(trimmed);
  };

  const handleDisconnect = async (server: string) => {
    if (!activeTenant) return;
    if (
      !confirm(`Revoke OAuth credentials for ${activeTenant}/${server}? This cannot be undone.`)
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/mcp/remote-servers/${encodeURIComponent(server)}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenant: activeTenant }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }; // empty-catch-ok: non-JSON error body — res.status is surfaced below
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setMessage(`Disconnected ${activeTenant}/${server}.`);
      await loadRemotes(activeTenant);
    } catch (err) {
      setMessage(`Disconnect failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">MCP</h1>
            <p className="mt-0.5 text-sm text-zinc-400">
              Built-in and OAuth-authorized servers, content exposure, and per-meter usage
            </p>
          </div>
          <a
            href="/mcp/connect"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Connect new server
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 bg-zinc-900/70">
        <nav className="mx-auto flex max-w-5xl gap-1 px-6" aria-label="MCP page tabs">
          {(['catalog', 'usage'] as CatalogTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm capitalize transition-colors ${
                activeTab === t
                  ? 'border-emerald-500 text-emerald-300'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
              aria-current={activeTab === t ? 'page' : undefined}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-5xl p-6">
        {activeTab === 'usage' && <UsageDashboard />}

        {activeTab === 'catalog' && (
          <>
            {message && (
              <div
                role="status"
                className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-300"
              >
                {message}
              </div>
            )}

            {/* Tenant scope selector */}
            <form
              onSubmit={handleLoadTenant}
              className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <label
                htmlFor="tenant-input"
                className="mb-1.5 block text-sm font-medium text-zinc-300"
              >
                Tenant
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="tenant-input"
                  name="tenant"
                  type="text"
                  value={tenant}
                  onChange={(e) => setTenant(e.target.value)}
                  pattern="[A-Za-z0-9_-]{1,64}"
                  placeholder="acme"
                  className="w-64 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!tenant.trim() || state === 'loading'}
                  className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {state === 'loading' ? 'Loading…' : 'Load'}
                </button>
                {activeTenant && state === 'ready' && (
                  <span className="text-xs text-zinc-500">
                    Showing remote servers for{' '}
                    <span className="font-mono text-zinc-400">{activeTenant}</span>
                  </span>
                )}
              </div>
            </form>

            {/* Remote servers (per tenant) */}
            <section className="mb-10">
              <h2 className="mb-3 text-lg font-medium text-white">
                Remote servers{' '}
                <span className="text-sm font-normal text-zinc-500">
                  {activeTenant ? `(${activeTenant})` : '(select a tenant)'}
                </span>
              </h2>
              {activeTenant && state === 'ready' && remotes.length === 0 && (
                <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
                  No remote servers connected for{' '}
                  <span className="font-mono text-zinc-400">{activeTenant}</span>. Click{' '}
                  <span className="font-medium text-zinc-300">Connect new server</span> to authorize
                  one.
                </div>
              )}
              {remotes.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-zinc-400">Server</th>
                        <th className="px-4 py-3 text-left font-medium text-zinc-400">Tenant</th>
                        <th className="px-4 py-3 text-left font-medium text-zinc-400">State</th>
                        <th className="px-4 py-3 text-right font-medium text-zinc-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {remotes.map((r) => (
                        <tr key={`${r.tenant}/${r.server}`} className="border-t border-zinc-800/50">
                          <td className="px-4 py-3 font-mono text-zinc-300">{r.server}</td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-500">{r.tenant}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                              {r.connectionState}
                            </span>
                          </td>
                          <td className="flex items-center justify-end gap-3 px-4 py-3 text-right">
                            <a
                              href={`/mcp/inspect?tenant=${encodeURIComponent(r.tenant)}&server=${encodeURIComponent(r.server)}`}
                              className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
                            >
                              Inspect
                            </a>
                            <button
                              type="button"
                              onClick={() => void handleDisconnect(r.server)}
                              className="text-xs font-medium text-red-400 hover:text-red-300"
                            >
                              Disconnect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Content exposure (tenant-agnostic in v1) */}
            <section className="mb-10">
              <h2 className="mb-1 text-lg font-medium text-white">
                Content exposure{' '}
                <span className="text-sm font-normal text-zinc-500">({collections.length})</span>
              </h2>
              <p className="mb-3 text-xs text-zinc-500">
                Collections exposed to MCP clients as resources via the{' '}
                <span className="font-mono text-zinc-400">revealui-content</span> server. Opt a
                collection out by setting{' '}
                <span className="font-mono text-zinc-400">mcpResource: false</span> in its
                CollectionConfig.
              </p>
              {collections.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
                  Loading collection exposure…
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-zinc-400">Slug</th>
                        <th className="px-4 py-3 text-left font-medium text-zinc-400">Label</th>
                        <th className="px-4 py-3 text-left font-medium text-zinc-400">Exposure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collections.map((c) => (
                        <tr key={c.slug} className="border-t border-zinc-800/50">
                          <td className="px-4 py-3 font-mono text-zinc-300">{c.slug}</td>
                          <td className="px-4 py-3 text-zinc-400">{c.labelPlural ?? c.label}</td>
                          <td className="px-4 py-3">
                            {c.mcpResource ? (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                                exposed
                              </span>
                            ) : (
                              <span className="rounded-full bg-zinc-700/40 px-2 py-0.5 text-xs font-medium text-zinc-400">
                                hidden
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Built-in servers (tenant-agnostic) */}
            <section>
              <h2 className="mb-3 text-lg font-medium text-white">
                Built-in servers{' '}
                <span className="text-sm font-normal text-zinc-500">({builtins.length})</span>
              </h2>
              {builtins.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
                  Loading built-in servers…
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {builtins.map((server) => (
                    <McpServerCard key={server.id} server={server} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
