import { Link } from '@revealui/router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { showcaseEntries } from '@/components/showcase/registry.js';
import type { ShowcaseStory } from '@/components/showcase/types.js';
import { useWildcardPath } from '@/hooks/useWildcardPath';

const ShowcaseShell = lazy(() =>
  import('@/components/showcase/ShowcaseShell.js').then((mod) => ({
    default: mod.ShowcaseShell,
  })),
);

const TokensPage = lazy(() =>
  import('@/components/showcase/TokensPage.js').then((mod) => ({
    default: mod.TokensPage,
  })),
);

/** Overview page listing all available showcase entries */
function ShowcaseOverview() {
  const grouped = new Map<string, typeof showcaseEntries>();
  for (const entry of showcaseEntries) {
    const group = grouped.get(entry.category) ?? [];
    group.push(entry);
    grouped.set(entry.category, group);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-8 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Component Showcase</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Interactive explorer for RevealUI's presentation components. Pick a component to see live
          previews, tweak props, and browse all variants.
        </p>
      </div>

      {/* Quick link to tokens */}
      <Link
        to="/showcase/tokens"
        className="block rounded-xl border border-border bg-surface p-6 no-underline transition-shadow hover:shadow-md"
      >
        <h2 className="text-lg font-semibold text-ink">Design Tokens</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Browse the OKLCH color palette, spacing scale, typography, border radius, shadows, and
          motion tokens that power every component.
        </p>
      </Link>

      {/* Component groups */}
      {[...grouped.entries()].map(([category, entries]) => (
        <div key={category}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
            {category}s
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <Link
                key={entry.slug}
                to={`/showcase/${entry.slug}`}
                className="rounded-xl border border-border bg-surface p-4 no-underline transition-shadow hover:shadow-md"
              >
                <span className="text-sm font-semibold text-ink">{entry.name}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Loads a story lazily and renders it inside ShowcaseShell */
function StoryLoader({ loader }: { loader: () => Promise<{ default: ShowcaseStory }> }) {
  const [story, setStory] = useState<ShowcaseStory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loader()
      .then((mod) => {
        if (!cancelled) setStory(mod.default);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load story');
      });
    return () => {
      cancelled = true;
    };
  }, [loader]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <p className="text-sm text-red-400">Error loading showcase: {error}</p>
      </div>
    );
  }

  if (!story) {
    return <LoadingSkeleton />;
  }

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ShowcaseShell story={story} />
    </Suspense>
  );
}

export function ShowcasePage() {
  const path = useWildcardPath();

  if (!path || path === '') {
    return <ShowcaseOverview />;
  }

  if (path === 'tokens') {
    return (
      <Suspense fallback={<LoadingSkeleton />}>
        <TokensPage />
      </Suspense>
    );
  }

  const entry = showcaseEntries.find((e) => e.slug === path);
  if (!entry) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <h1 className="text-xl font-bold text-ink">Not Found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          No showcase found for "<code className="font-mono text-accent">{path}</code>".
        </p>
        <Link to="/showcase" className="mt-4 inline-block text-sm text-accent hover:underline">
          Back to overview
        </Link>
      </div>
    );
  }

  return <StoryLoader loader={entry.loader} />;
}
