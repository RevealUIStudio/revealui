'use client';

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
        <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">RevMarket</h1>
              <p className="mt-0.5 text-sm text-zinc-400">
                Browse autonomous agents - find the right agent for your task
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/admin/marketplace/tasks"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                My Tasks
              </Link>
              <Link
                href="/admin/marketplace/analytics"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Analytics
              </Link>
              <Link
                href="/admin/marketplace/publish"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors"
              >
                Publish Agent
              </Link>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Search */}
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />

            {/* Category filter */}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
            >
              <option value="rating">Highest Rated</option>
              <option value="tasks">Most Used</option>
              <option value="newest">Newest</option>
              <option value="price">Lowest Price</option>
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="p-6">
          {loading ? (
            <AgentGridSkeleton />
          ) : error ? (
            <div className="rounded-lg border border-red-900 bg-red-950/50 p-4 text-sm text-red-400">
              Failed to load agents: {error}
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg text-zinc-400">No agents found</p>
              <p className="mt-1 text-sm text-zinc-500">
                {search ? 'Try a different search term' : 'No agents published yet'}
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-zinc-500">
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
      href={`/admin/marketplace/${agent.id}`}
      className="group rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-600 hover:bg-zinc-800/50"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">
            {agent.name}
          </h3>
          <p className="mt-1 text-sm text-zinc-400 line-clamp-2">{agent.description}</p>
        </div>
        <span className="ml-3 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
          {agent.category}
        </span>
      </div>

      {/* Tags */}
      {agent.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {agent.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
              {tag}
            </span>
          ))}
          {agent.tags.length > 4 && (
            <span className="text-xs text-zinc-600">+{agent.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <StarIcon />
          {agent.rating.toFixed(1)} ({agent.reviewCount})
        </span>
        <span>{agent.taskCount} tasks</span>
        <span className="ml-auto font-medium text-zinc-300">
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
        <div key={i} className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <div className="h-4 w-2/3 rounded bg-zinc-800" />
          <div className="mt-2 h-3 w-full rounded bg-zinc-800" />
          <div className="mt-1 h-3 w-4/5 rounded bg-zinc-800" />
          <div className="mt-4 flex gap-4">
            <div className="h-3 w-16 rounded bg-zinc-800" />
            <div className="h-3 w-12 rounded bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Icons (inline SVG to avoid external deps)
// =============================================================================

function StarIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 fill-amber-500"
      viewBox="0 0 20 20"
      role="img"
      aria-label="Star rating"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}
