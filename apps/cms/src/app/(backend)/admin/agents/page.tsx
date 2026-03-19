'use client';

import type { A2AAgentCard } from '@revealui/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AgentCard } from '@/lib/components/agents/agent-card';
import { McpServerCard, type McpServerInfo } from '@/lib/components/agents/mcp-server-card';
import { LicenseGate } from '@/lib/components/LicenseGate';

export const dynamic = 'force-dynamic';

type Tab = 'agents' | 'mcp';

interface AgentWithId {
  card: A2AAgentCard;
  agentId: string;
}

export default function AgentsPage() {
  const [tab, setTab] = useState<Tab>('agents');

  return (
    <LicenseGate feature="ai">
      <div className="min-h-screen">
        {/* Page header */}
        <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <h1 className="text-xl font-semibold text-white">Agents</h1>
          <p className="mt-0.5 text-sm text-zinc-400">
            A2A agent cards and MCP server integrations
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-zinc-800 bg-zinc-950 px-6">
          <nav className="flex gap-1 -mb-px">
            {(['agents', 'mcp'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'border-white text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t === 'agents' ? 'Agent Cards' : 'MCP Servers'}
              </button>
            ))}
          </nav>
        </div>

        {/* Panel content */}
        <div className="p-6">{tab === 'agents' ? <AgentCardsPanel /> : <McpServersPanel />}</div>
      </div>
    </LicenseGate>
  );
}

// =============================================================================
// Agent Cards panel
// =============================================================================

function AgentCardsPanel() {
  const [agents, setAgents] = useState<AgentWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  useEffect(() => {
    fetch(`${apiUrl}/a2a/agents`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { agents: A2AAgentCard[] }) => {
        // Derive agentId from skills[0].id or fallback to slugified name
        const withIds: AgentWithId[] = (data.agents ?? []).map((card) => ({
          card,
          agentId: card.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, ''),
        }));
        setAgents(withIds);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred';
        setError(
          `Unable to load agent list. ${message}. Contact support@revealui.com if this persists.`,
        );
      })
      .finally(() => setLoading(false));
  }, [apiUrl]);

  if (loading) {
    return (
      <output aria-label="Loading" className="flex h-32 items-center justify-center">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200"
          aria-hidden="true"
        />
      </output>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400"
      >
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-zinc-400">{agents.length} agent(s) registered</p>
        <Link
          href="/admin/agents/new"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
        >
          + New Agent
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map(({ card, agentId }) => (
          <AgentCard key={agentId} card={card} agentId={agentId} />
        ))}
        {agents.length === 0 && (
          <p className="col-span-3 py-12 text-center text-sm text-zinc-500">
            No agents registered yet.
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MCP Servers panel
// =============================================================================

function McpServersPanel() {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/mcp/servers')
      .then((r) => r.json())
      .then((data: { servers: McpServerInfo[] }) => setServers(data.servers ?? []))
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred';
        setError(
          `Unable to load MCP servers. ${message}. Contact support@revealui.com if this persists.`,
        );
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <output aria-label="Loading" className="flex h-32 items-center justify-center">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200"
          aria-hidden="true"
        />
      </output>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400"
      >
        {error}
      </div>
    );
  }

  const total = servers.reduce((n, s) => n + s.tools.length, 0);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <p className="text-sm text-zinc-400">
          {servers.length} server(s) · {total} tools
        </p>
        <span className="text-xs text-zinc-600">
          Start with <code className="font-mono">revealui dev up --include mcp</code>
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {servers.map((server) => (
          <McpServerCard key={server.id} server={server} />
        ))}
      </div>
    </div>
  );
}
