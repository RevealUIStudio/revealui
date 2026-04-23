/**
 * MCP — Server Catalog (/admin/mcp)
 *
 * Stage 3.1 of the MCP v1 plan. Lists both built-in MCP servers (driven by
 * `/api/mcp/servers`, the existing endpoint shared with the `/admin/agents`
 * MCP tab) and OAuth-authorized remote servers for the active tenant
 * (driven by the new `/api/mcp/remote-servers?tenant=X`).
 *
 * Scope is intentionally thin: list, connect (link to `/admin/mcp/connect`),
 * disconnect. Tool/resource/prompt browsing lands in Stage 3.2–3.4.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { McpServerCard, type McpServerInfo } from '@/lib/components/agents/mcp-server-card';

interface RemoteServerSummary {
  tenant: string;
  server: string;
  connectionState: 'connected';
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function McpCatalogPage() {
  const [tenant, setTenant] = useState<string>('');
  const [activeTenant, setActiveTenant] = useState<string | null>(null);
  const [builtins, setBuiltins] = useState<McpServerInfo[]>([]);
  const [remotes, setRemotes] = useState<RemoteServerSummary[]>([]);
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
            <h1 className="text-xl font-semibold text-white">MCP Server Catalog</h1>
            <p className="mt-0.5 text-sm text-zinc-400">
              Built-in servers and OAuth-authorized remote servers per tenant
            </p>
          </div>
          <a
            href="/admin/mcp/connect"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Connect new server
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-6">
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
          <label htmlFor="tenant-input" className="mb-1.5 block text-sm font-medium text-zinc-300">
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
                          href={`/admin/mcp/inspect?tenant=${encodeURIComponent(r.tenant)}&server=${encodeURIComponent(r.server)}`}
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
      </div>
    </div>
  );
}
