'use client';

import {
  Badge,
  EmptyState,
  LinkButton,
  Skeleton,
  Stat,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@revealui/presentation';
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
            <LinkButton href="/marketplace/publish">Publish New Agent</LinkButton>
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
                <Stat
                  label="Published"
                  value={String(published)}
                  description={`${drafts} drafts`}
                />
                <Stat label="Total Tasks" value={String(totalTasks)} description="completed" />
                <Stat
                  label="Revenue"
                  value={`$${totalRevenue.toFixed(2)}`}
                  description="USDC earned"
                />
                <Stat
                  label="Avg Rating"
                  value={avgRating.toFixed(1)}
                  description={`across ${agents.length} agents`}
                />
              </div>

              {/* Agent table */}
              <h2 className="text-lg font-medium text-foreground mb-4">Your Agents</h2>

              {agents.length === 0 ? (
                <EmptyState
                  title="No agents yet"
                  action={
                    <LinkButton href="/marketplace/publish">Publish Your First Agent</LinkButton>
                  }
                />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Agent</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Version</TableHeader>
                      <TableHeader>Tasks</TableHeader>
                      <TableHeader>Rating</TableHeader>
                      <TableHeader>Revenue</TableHeader>
                      <TableHeader>Created</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {agents.map((agent) => {
                      const revenue = agent.taskCount * Number.parseFloat(agent.basePriceUsdc);
                      return (
                        <TableRow key={agent.id}>
                          <TableCell>
                            <Link
                              href={`/marketplace/${agent.id}`}
                              className="font-medium text-foreground hover:text-primary transition-colors"
                            >
                              {agent.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">{agent.category}</p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              color={
                                agent.status === 'published'
                                  ? 'success'
                                  : agent.status === 'draft'
                                    ? 'warning'
                                    : 'muted'
                              }
                            >
                              {agent.status}
                            </Badge>
                          </TableCell>
                          <TableCell>v{agent.version}</TableCell>
                          <TableCell>{agent.taskCount}</TableCell>
                          <TableCell>
                            <span className="text-warning-foreground">★</span>{' '}
                            <span className="text-foreground">{agent.rating.toFixed(1)}</span>
                            <span className="text-muted-foreground"> ({agent.reviewCount})</span>
                          </TableCell>
                          <TableCell>${revenue.toFixed(2)}</TableCell>
                          <TableCell>{new Date(agent.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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

function AnalyticsSkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-5 w-28 mb-4" />
      <Skeleton className="h-64 rounded-lg" />
    </>
  );
}
