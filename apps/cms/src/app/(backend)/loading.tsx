import { Skeleton, SkeletonCard } from '@revealui/presentation/server';

export default function BackendLoading() {
  return (
    <div className="min-h-screen">
      {/* Header skeleton */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <Skeleton className="h-6 w-40 bg-zinc-800" />
        <Skeleton className="mt-2 h-4 w-64 bg-zinc-800" />
      </div>

      {/* Content skeleton */}
      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard className="border-zinc-800 bg-zinc-800/40" />
          <SkeletonCard className="border-zinc-800 bg-zinc-800/40" />
          <SkeletonCard className="border-zinc-800 bg-zinc-800/40" />
        </div>
      </div>
    </div>
  );
}
