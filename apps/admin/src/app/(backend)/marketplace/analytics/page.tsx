'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types
// =============================================================================

interface AgentAnalytics {
  id: string;
  name: string;
  status: string;
  version: string;
  taskCount: number;
  rating: number;
  reviewCount: number;
  basePriceUsdc: string;
  category: string;
  createdAt: string;
}

// =============================================================================
// Analytics Dashboard
// =============================================================================

export default function AnalyticsPage() {
  const [agents, setAgents] = useState<AgentAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  useEffect(() => {
    fetch(`${apiUrl}/api/revmarket/agents?mine=true`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { agents: AgentAnalytics[] }) => {
        setAgents(data.agents ?? []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const totalTasks = agents.reduce((sum, a) => sum + a.taskCount, 0);
  const totalRevenue = agents.reduce(
    (sum, a) => sum + a.taskCount * Number.parseFloat(a.basePriceUsdc),
    0,
  );
  const avgRating =
    agents.length > 0 ? agents.reduce((sum, a) => sum + a.rating, 0) / agents.length : 0;
  const published = agents.filter((a) => a.status === 'published').length;
  const drafts = agents.filter((a) => a.status === 'draft').length;

  return (
    <LicenseGate feature="ai">
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/marketplace"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                RevMarket
              </Link>
              <span className="mx-2 text-muted-foreground">/</span>
              <span className="text-sm text-muted-foreground">Analytics</span>
              <h1 className="mt-1 text-xl font-semibold text-foreground">Agent Analytics</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Performance metrics and version history for your agents
              </p>
            </div>
            <Link
              href="/marketplace/publish"
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Publish New Agent
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <AnalyticsSkeleton />
          ) : error ? (
            <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
              Failed to load analytics: {error}
            </div>
          ) : (
            <>
              {/* Overview cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <MetricCard
                  label="Published"
                  value={String(published)}
                  sublabel={`${drafts} drafts`}
                />
                <MetricCard label="Total Tasks" value={String(totalTasks)} sublabel="completed" />
                <MetricCard
                  label="Revenue"
                  value={`$${totalRevenue.toFixed(2)}`}
                  sublabel="USDC earned"
                />
                <MetricCard
                  label="Avg Rating"
                  value={avgRating.toFixed(1)}
                  sublabel={`across ${agents.length} agents`}
                />
              </div>

              {/* Agent table */}
              <h2 className="text-lg font-medium text-foreground mb-4">Your Agents</h2>

              {agents.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <p className="text-muted-foreground">No agents yet</p>
                  <Link
                    href="/marketplace/publish"
                    className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    Publish Your First Agent
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-card text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Agent</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Version</th>
                        <th className="px-4 py-3 font-medium text-right">Tasks</th>
                        <th className="px-4 py-3 font-medium text-right">Rating</th>
                        <th className="px-4 py-3 font-medium text-right">Revenue</th>
                        <th className="px-4 py-3 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {agents.map((agent) => {
                        const revenue = agent.taskCount * Number.parseFloat(agent.basePriceUsdc);
                        return (
                          <tr key={agent.id} className="bg-muted hover:bg-card transition-colors">
                            <td className="px-4 py-3">
                              <Link
                                href={`/marketplace/${agent.id}`}
                                className="font-medium text-foreground hover:text-primary transition-colors"
                              >
                                {agent.name}
                              </Link>
                              <p className="text-xs text-muted-foreground">{agent.category}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded px-2 py-0.5 text-xs ${
                                  agent.status === 'published'
                                    ? 'bg-success/10 text-success'
                                    : agent.status === 'draft'
                                      ? 'bg-warning/15 text-warning-foreground'
                                      : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {agent.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">v{agent.version}</td>
                            <td className="px-4 py-3 text-right text-foreground">
                              {agent.taskCount}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-warning-foreground">★</span>{' '}
                              <span className="text-foreground">{agent.rating.toFixed(1)}</span>
                              <span className="text-muted-foreground"> ({agent.reviewCount})</span>
                            </td>
                            <td className="px-4 py-3 text-right text-foreground">
                              ${revenue.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {new Date(agent.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </LicenseGate>
  );
}

// =============================================================================
// Metric Card
// =============================================================================

function MetricCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
    </div>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

function AnalyticsSkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
          <div key={i} className="animate-pulse rounded-lg border border-border bg-card p-5">
            <div className="h-3 w-16 rounded bg-foreground/10" />
            <div className="mt-2 h-7 w-20 rounded bg-foreground/10" />
            <div className="mt-1 h-2.5 w-12 rounded bg-foreground/10" />
          </div>
        ))}
      </div>
      <div className="h-5 w-28 rounded bg-foreground/10 mb-4" />
      <div className="animate-pulse rounded-lg border border-border bg-card h-64" />
    </>
  );
}
