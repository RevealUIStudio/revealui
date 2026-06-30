'use client';

import { Badge, Card, EmptyState, Skeleton, Stat } from '@revealui/presentation';
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
        <div className="border-b border-border bg-card px-6 py-4">
          <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">
            RevMarket
          </Link>
          <span className="mx-2 text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">Earnings</span>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Publisher Earnings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Revenue from your published agents</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <EarningsSkeleton />
          ) : error ? (
            <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
              Failed to load earnings: {error}
            </div>
          ) : !summary ? (
            <p className="text-sm text-muted-foreground">No data available</p>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid gap-4 sm:grid-cols-3 mb-8">
                <Stat
                  label="Total Earnings"
                  value={`$${summary.totalEarningsUsdc.toFixed(2)}`}
                  description="USDC"
                />
                <Stat
                  label="Tasks Completed"
                  value={String(summary.totalTasks)}
                  description="across all agents"
                />
                <Stat
                  label="Published Agents"
                  value={String(summary.agentCount)}
                  description="active in marketplace"
                />
              </div>

              {/* Agent earnings breakdown */}
              <h2 className="text-lg font-medium text-foreground mb-4">Earnings by Agent</h2>
              {summary.agents.length === 0 ? (
                <EmptyState
                  title="No published agents yet"
                  description="Publish an agent to start earning"
                />
              ) : (
                <div className="space-y-3">
                  {summary.agents.map((agent) => {
                    const earnings = agent.taskCount * Number.parseFloat(agent.basePriceUsdc);
                    return (
                      <Card key={agent.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="flex-1">
                          <Link
                            href={`/marketplace/${agent.id}`}
                            className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {agent.name}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              ★ {agent.rating.toFixed(1)} ({agent.reviewCount})
                            </span>
                            <span>{agent.taskCount} tasks</span>
                            <Badge color={agent.status === 'published' ? 'success' : 'muted'}>
                              {agent.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">
                            ${earnings.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ${agent.basePriceUsdc}/task
                          </p>
                        </div>
                      </Card>
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
// Skeleton
// =============================================================================

function EarningsSkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {Array.from({ length: 3 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-5 w-32 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </>
  );
}
