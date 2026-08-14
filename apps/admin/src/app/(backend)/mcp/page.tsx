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

import {
  Badge,
  Button,
  Input,
  LinkButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@revealui/presentation';
import { Field, Label } from '@revealui/presentation/client';
import { useCallback, useEffect, useState } from 'react';
import { McpServerCard, type McpServerInfo } from '@/lib/components/agents/mcp-server-card';
import { UsageDashboard } from '@/lib/components/mcp/usage-dashboard';
import type { CollectionMcpSummary } from '@/lib/mcp/collections';
import { apiFetch } from '@/lib/utils/csrf';

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
      const res = await apiFetch(
        `/api/mcp/remote-servers/${encodeURIComponent(server)}/disconnect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tenant: activeTenant }),
        },
      );
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
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">MCP</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Built-in and OAuth-authorized servers, content exposure, and per-meter usage
            </p>
          </div>
          <LinkButton href="/mcp/connect" variant="brand">
            Connect new server
          </LinkButton>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border bg-card">
        <nav className="mx-auto flex max-w-5xl gap-1 px-6" aria-label="MCP page tabs">
          {(['catalog', 'usage'] as CatalogTab[]).map((t) => (
            <Button
              key={t}
              type="button"
              appearance="ghost"
              variant={activeTab === t ? 'success' : 'neutral'}
              size="sm"
              onClick={() => setActiveTab(t)}
              className={`-mb-px h-auto rounded-none border-b-2 px-3 py-2 text-sm capitalize ${
                activeTab === t
                  ? 'border-success text-success'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              aria-current={activeTab === t ? 'page' : undefined}
            >
              {t}
            </Button>
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
                className="mb-6 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground"
              >
                {message}
              </div>
            )}

            {/* Tenant scope selector */}
            <form
              onSubmit={handleLoadTenant}
              className="mb-8 rounded-lg border border-border bg-card p-4"
            >
              <Field>
                <Label>Tenant</Label>
                <div className="flex items-center gap-3">
                  <Input
                    name="tenant"
                    type="text"
                    value={tenant}
                    onChange={(e) => setTenant(e.target.value)}
                    pattern="[A-Za-z0-9_-]{1,64}"
                    placeholder="acme"
                  />
                  <Button
                    type="submit"
                    appearance="outline"
                    variant="neutral"
                    disabled={!tenant.trim() || state === 'loading'}
                  >
                    {state === 'loading' ? 'Loading…' : 'Load'}
                  </Button>
                  {activeTenant && state === 'ready' && (
                    <span className="text-xs text-muted-foreground">
                      Showing remote servers for{' '}
                      <span className="font-mono text-muted-foreground">{activeTenant}</span>
                    </span>
                  )}
                </div>
              </Field>
            </form>

            {/* Remote servers (per tenant) */}
            <section className="mb-10">
              <h2 className="mb-3 text-lg font-medium text-foreground">
                Remote servers{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  {activeTenant ? `(${activeTenant})` : '(select a tenant)'}
                </span>
              </h2>
              {activeTenant && state === 'ready' && remotes.length === 0 && (
                <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  No remote servers connected for{' '}
                  <span className="font-mono text-muted-foreground">{activeTenant}</span>. Click{' '}
                  <span className="font-medium text-foreground">Connect new server</span> to
                  authorize one.
                </div>
              )}
              {remotes.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Server</TableHeader>
                        <TableHeader>Tenant</TableHeader>
                        <TableHeader>State</TableHeader>
                        <TableHeader className="text-right">Actions</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {remotes.map((r) => (
                        <TableRow key={`${r.tenant}/${r.server}`}>
                          <TableCell className="font-mono text-muted-foreground">
                            {r.server}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {r.tenant}
                          </TableCell>
                          <TableCell>
                            <Badge intent="success">{r.connectionState}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-3">
                              <a
                                href={`/mcp/inspect?tenant=${encodeURIComponent(r.tenant)}&server=${encodeURIComponent(r.server)}`}
                                className="text-xs font-medium text-success hover:text-success"
                              >
                                Inspect
                              </a>
                              <Button
                                type="button"
                                appearance="link"
                                variant="danger"
                                size="sm"
                                onClick={() => void handleDisconnect(r.server)}
                                className="h-auto px-0 py-0 text-xs font-medium"
                              >
                                Disconnect
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            {/* Content exposure (tenant-agnostic in v1) */}
            <section className="mb-10">
              <h2 className="mb-1 text-lg font-medium text-foreground">
                Content exposure{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  ({collections.length})
                </span>
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Collections exposed to MCP clients as resources via the{' '}
                <span className="font-mono text-muted-foreground">revealui-content</span> server.
                Opt a collection out by setting{' '}
                <span className="font-mono text-muted-foreground">mcpResource: false</span> in its
                CollectionConfig.
              </p>
              {collections.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  Loading collection exposure…
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Slug</TableHeader>
                        <TableHeader>Label</TableHeader>
                        <TableHeader>Exposure</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {collections.map((c) => (
                        <TableRow key={c.slug}>
                          <TableCell className="font-mono text-muted-foreground">
                            {c.slug}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {c.labelPlural ?? c.label}
                          </TableCell>
                          <TableCell>
                            {c.mcpResource ? (
                              <Badge intent="success">exposed</Badge>
                            ) : (
                              <Badge intent="muted">hidden</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            {/* Built-in servers (tenant-agnostic) */}
            <section>
              <h2 className="mb-3 text-lg font-medium text-foreground">
                Built-in servers{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  ({builtins.length})
                </span>
              </h2>
              {builtins.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
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
