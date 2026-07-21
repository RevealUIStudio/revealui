'use client';

import type { A2AAgentCard } from '@revealui/contracts';
import {
  Button,
  EmptyState,
  IconStar,
  IconTerminal,
  LinkButton,
  Skeleton,
  SkeletonText,
} from '@revealui/presentation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AgentCard } from '@/lib/components/agents/agent-card';
import { McpServerCard, type McpServerInfo } from '@/lib/components/agents/mcp-server-card';
import { LicenseGate } from '@/lib/components/LicenseGate';

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
        <div className="border-b border-border bg-card px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">Agents</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A2A agent cards and MCP server integrations
          </p>
        </div>

        {/* Tab strip — left as handroll: Tab primitive hard-codes border-blue-600 (not border-primary) */}
        <div className="border-b border-border bg-muted px-6">
          <nav className="flex gap-1 -mb-px">
            {(['agents', 'mcp'] as Tab[]).map((t) => (
              <Button
                key={t}
                type="button"
                appearance="ghost"
                variant="neutral"
                onClick={() => setTab(t)}
                className={`h-auto rounded-none border-b-2 px-4 py-3 text-sm font-medium ${
                  tab === t
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'agents' ? 'Agent Cards' : 'MCP Servers'}
              </Button>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="mb-3 h-5 w-2/3" />
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error"
      >
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{agents.length} agent(s) registered</p>
        <LinkButton as={Link} href="/agents/new" variant="brand" size="sm">
          + New Agent
        </LinkButton>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          icon={<IconStar className="size-6" aria-hidden="true" />}
          title="No agents registered"
          description="Create your first AI agent to get started with automated tasks and workflows."
          action={
            <LinkButton as={Link} href="/agents/new" variant="brand" size="sm">
              Create Agent
            </LinkButton>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map(({ card, agentId }) => (
            <AgentCard key={agentId} card={card} agentId={agentId} />
          ))}
        </div>
      )}
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="mb-3 h-5 w-1/2" />
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error"
      >
        {error}
      </div>
    );
  }

  const total = servers.reduce((n, s) => n + s.tools.length, 0);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <p className="text-sm text-muted-foreground">
          {servers.length} server(s) · {total} tools
        </p>
        <span className="text-xs text-muted-foreground">
          Start with <code className="font-mono">revealui dev up --include mcp</code>
        </span>
      </div>

      {servers.length === 0 ? (
        <EmptyState
          icon={<IconTerminal className="size-6" aria-hidden="true" />}
          title="No MCP servers connected"
          description="Start your development environment with MCP support to connect servers."
          action={
            <code className="rounded-lg bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">
              revealui dev up --include mcp
            </code>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <McpServerCard key={server.id} server={server} />
          ))}
        </div>
      )}
    </div>
  );
}
