'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types
// =============================================================================

interface PublishedAgent {
  id: string;
  name: string;
  taskCount: number;
  rating: number;
  reviewCount: number;
  basePriceUsdc: string;
  status: string;
}

interface EarningsSummary {
  totalEarningsUsdc: number;
  totalTasks: number;
  agentCount: number;
  agents: PublishedAgent[];
}

// =============================================================================
// Earnings Dashboard
// =============================================================================

export default function EarningsDashboardPage() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  useEffect(() => {
    // Fetch publisher's agents and compute earnings
    fetch(`${apiUrl}/api/revmarket/agents?mine=true`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { agents: PublishedAgent[] }) => {
        const agents = data.agents ?? [];
        const totalTasks = agents.reduce((sum, a) => sum + a.taskCount, 0);
        const totalEarnings = agents.reduce(
          (sum, a) => sum + a.taskCount * Number.parseFloat(a.basePriceUsdc),
          0,
        );

        setSummary({
          totalEarningsUsdc: totalEarnings,
          totalTasks,
          agentCount: agents.length,
          agents,
        });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  return (
    <LicenseGate feature="ai">
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <Link href="/marketplace" className="text-sm text-zinc-500 hover:text-zinc-300">
            RevMarket
          </Link>
          <span className="mx-2 text-zinc-700">/</span>
          <span className="text-sm text-zinc-300">Earnings</span>
          <h1 className="mt-1 text-xl font-semibold text-white">Publisher Earnings</h1>
          <p className="mt-0.5 text-sm text-zinc-400">Revenue from your published agents</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <EarningsSkeleton />
          ) : error ? (
            <div className="rounded-lg border border-red-900 bg-red-950/50 p-4 text-sm text-red-400">
              Failed to load earnings: {error}
            </div>
          ) : !summary ? (
            <p className="text-sm text-zinc-500">No data available</p>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid gap-4 sm:grid-cols-3 mb-8">
                <SummaryCard
                  label="Total Earnings"
                  value={`$${summary.totalEarningsUsdc.toFixed(2)}`}
                  sublabel="USDC"
                />
                <SummaryCard
                  label="Tasks Completed"
                  value={String(summary.totalTasks)}
                  sublabel="across all agents"
                />
                <SummaryCard
                  label="Published Agents"
                  value={String(summary.agentCount)}
                  sublabel="active in marketplace"
                />
              </div>

              {/* Agent earnings breakdown */}
              <h2 className="text-lg font-medium text-white mb-4">Earnings by Agent</h2>
              {summary.agents.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <p className="text-zinc-400">No published agents yet</p>
                  <p className="mt-1 text-sm text-zinc-500">Publish an agent to start earning</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {summary.agents.map((agent) => {
                    const earnings = agent.taskCount * Number.parseFloat(agent.basePriceUsdc);
                    return (
                      <div
                        key={agent.id}
                        className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
                      >
                        <div className="flex-1">
                          <Link
                            href={`/marketplace/${agent.id}`}
                            className="text-sm font-medium text-white hover:text-blue-400 transition-colors"
                          >
                            {agent.name}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500">
                            <span>
                              ★ {agent.rating.toFixed(1)} ({agent.reviewCount})
                            </span>
                            <span>{agent.taskCount} tasks</span>
                            <span
                              className={`rounded px-2 py-0.5 text-xs ${
                                agent.status === 'published'
                                  ? 'bg-green-900/50 text-green-400'
                                  : 'bg-zinc-800 text-zinc-500'
                              }`}
                            >
                              {agent.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-white">${earnings.toFixed(2)}</p>
                          <p className="text-xs text-zinc-500">${agent.basePriceUsdc}/task</p>
                        </div>
                      </div>
                    );
                  })}
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
// Summary Card
// =============================================================================

function SummaryCard({
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

function EarningsSkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {Array.from({ length: 3 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
          <div key={i} className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <div className="h-3 w-20 rounded bg-zinc-800" />
            <div className="mt-2 h-7 w-24 rounded bg-zinc-800" />
            <div className="mt-1 h-2.5 w-16 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
      <div className="h-5 w-32 rounded bg-zinc-800 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
            key={i}
            className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
          >
            <div className="flex items-center gap-4">
              <div className="h-4 w-40 rounded bg-zinc-800" />
              <div className="ml-auto h-4 w-16 rounded bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
