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
        <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/marketplace" className="text-sm text-zinc-500 hover:text-zinc-300">
                RevMarket
              </Link>
              <span className="mx-2 text-zinc-700">/</span>
              <span className="text-sm text-zinc-300">Analytics</span>
              <h1 className="mt-1 text-xl font-semibold text-white">Agent Analytics</h1>
              <p className="mt-0.5 text-sm text-zinc-400">
                Performance metrics and version history for your agents
              </p>
            </div>
            <Link
              href="/marketplace/publish"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors"
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
            <div className="rounded-lg border border-red-900 bg-red-950/50 p-4 text-sm text-red-400">
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
              <h2 className="text-lg font-medium text-white mb-4">Your Agents</h2>

              {agents.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <p className="text-zinc-400">No agents yet</p>
                  <Link
                    href="/marketplace/publish"
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    Publish Your First Agent
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-900 text-zinc-500">
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
                    <tbody className="divide-y divide-zinc-800">
                      {agents.map((agent) => {
                        const revenue = agent.taskCount * Number.parseFloat(agent.basePriceUsdc);
                        return (
                          <tr
                            key={agent.id}
                            className="bg-zinc-950 hover:bg-zinc-900 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <Link
                                href={`/marketplace/${agent.id}`}
                                className="font-medium text-white hover:text-blue-400 transition-colors"
                              >
                                {agent.name}
                              </Link>
                              <p className="text-xs text-zinc-600">{agent.category}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded px-2 py-0.5 text-xs ${
                                  agent.status === 'published'
                                    ? 'bg-green-900/50 text-green-400'
                                    : agent.status === 'draft'
                                      ? 'bg-yellow-900/50 text-yellow-400'
                                      : 'bg-zinc-800 text-zinc-500'
                                }`}
                              >
                                {agent.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-400">v{agent.version}</td>
                            <td className="px-4 py-3 text-right text-white">{agent.taskCount}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-amber-400">★</span>{' '}
                              <span className="text-white">{agent.rating.toFixed(1)}</span>
                              <span className="text-zinc-600"> ({agent.reviewCount})</span>
                            </td>
                            <td className="px-4 py-3 text-right text-white">
                              ${revenue.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-zinc-500">
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
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-600">{sublabel}</p>
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
          <div key={i} className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <div className="h-3 w-16 rounded bg-zinc-800" />
            <div className="mt-2 h-7 w-20 rounded bg-zinc-800" />
            <div className="mt-1 h-2.5 w-12 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
      <div className="h-5 w-28 rounded bg-zinc-800 mb-4" />
      <div className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 h-64" />
    </>
  );
}
