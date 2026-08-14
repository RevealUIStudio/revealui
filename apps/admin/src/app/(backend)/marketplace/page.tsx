'use client';

import {
  Badge,
  EmptyState,
  IconStar,
  Input,
  LinkButton,
  Select,
  Skeleton,
} from '@revealui/presentation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types
// =============================================================================

interface MarketplaceAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  rating: number;
  reviewCount: number;
  taskCount: number;
  basePriceUsdc: string;
  pricingModel: string;
  version: string;
  status: string;
}

type SortOption = 'rating' | 'tasks' | 'newest' | 'price';

const CATEGORIES = [
  'all',
  'coding',
  'writing',
  'data',
  'design',
  'devops',
  'security',
  'testing',
  'other',
] as const;

// =============================================================================
// Browse/Search Page
// =============================================================================

export default function MarketplacePage() {
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<SortOption>('rating');
  const [total, setTotal] = useState(0);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category !== 'all') params.set('category', category);
    params.set('sort', sort);

    fetch(`${apiUrl}/api/revmarket/agents?${params.toString()}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { agents: MarketplaceAgent[]; total: number }) => {
        setAgents(data.agents ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiUrl, search, category, sort]);

  return (
    <LicenseGate feature="ai">
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">RevMarket</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Browse autonomous agents - find the right agent for your task
              </p>
            </div>
            <div className="flex gap-2">
              <LinkButton
                href="/marketplace/tasks"
                appearance="outline"
                variant="neutral"
                size="sm"
              >
                My Tasks
              </LinkButton>
              <LinkButton
                href="/marketplace/analytics"
                appearance="outline"
                variant="neutral"
                size="sm"
              >
                Analytics
              </LinkButton>
              <LinkButton href="/marketplace/publish">Publish Agent</LinkButton>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="border-b border-border bg-muted px-6 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Search — no label; bare Input intentional for search-box pattern */}
            <Input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />

            {/* Category filter — no label; bare Select intentional */}
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </Select>

            {/* Sort filter — no label; bare Select intentional */}
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
              <option value="rating">Highest Rated</option>
              <option value="tasks">Most Used</option>
              <option value="newest">Newest</option>
              <option value="price">Lowest Price</option>
            </Select>
          </div>
        </div>

        {/* Results */}
        <div className="p-6">
          {loading ? (
            <AgentGridSkeleton />
          ) : error ? (
            <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
              Failed to load agents: {error}
            </div>
          ) : agents.length === 0 ? (
            <EmptyState
              title="No agents found"
              description={search ? 'Try a different search term' : 'No agents published yet'}
            />
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {total} agent{total !== 1 ? 's' : ''} found
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                  <MarketplaceAgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </LicenseGate>
  );
}

// =============================================================================
// Agent Card
// =============================================================================

function MarketplaceAgentCard({ agent }: { agent: MarketplaceAgent }) {
  return (
    <Link
      href={`/marketplace/${agent.id}`}
      className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-border hover:bg-muted"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
            {agent.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
        </div>
        <Badge intent="muted">{agent.category}</Badge>
      </div>

      {/* Tags */}
      {agent.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {agent.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} intent="muted">
              {tag}
            </Badge>
          ))}
          {agent.tags.length > 4 && (
            <span className="text-xs text-muted-foreground">+{agent.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <IconStar size="xs" className="fill-warning text-warning" />
          {agent.rating.toFixed(1)} ({agent.reviewCount})
        </span>
        <span>{agent.taskCount} tasks</span>
        <span className="ml-auto font-medium text-foreground">
          ${agent.basePriceUsdc}/{agent.pricingModel === 'per-task' ? 'task' : 'min'}
        </span>
      </div>
    </Link>
  );
}

// =============================================================================
// Skeleton loader
// =============================================================================

function AgentGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
        <Skeleton key={i} className="h-40 rounded-lg" />
      ))}
    </div>
  );
}
