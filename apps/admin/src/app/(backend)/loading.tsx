import { Skeleton, SkeletonCard } from '@revealui/presentation/server';

export default function BackendLoading() {
  return (
    <div className="min-h-screen">
      {/* Header skeleton */}
      <div className="border-b border-border bg-card px-6 py-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      {/* Content skeleton */}
      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}
