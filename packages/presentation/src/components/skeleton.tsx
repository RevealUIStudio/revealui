import type React from 'react';
import { cn } from '../utils/cn.js';

export function Skeleton({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={cn('animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700', className)}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => {
        return (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton lines are generated placeholders with no stable ID
            key={i}
            className={cn('h-4', i === lines - 1 && lines > 1 ? 'w-4/5' : 'w-full')}
          />
        );
      })}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-zinc-200 p-4 dark:border-zinc-700', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={3} className="mt-4" />
    </div>
  );
}
