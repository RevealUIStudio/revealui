import type React from 'react';
import { cn } from '../utils/cn.js';

export function Timeline({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <ol className={cn('relative', className)}>{children}</ol>;
}

export function TimelineItem({
  icon,
  date,
  title,
  description,
  isLast = false,
  className,
}: {
  icon?: React.ReactNode;
  date?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  isLast?: boolean;
  className?: string;
}) {
  return (
    <li className={cn('relative flex gap-4', !isLast && 'pb-8', className)}>
      {/* Connector line */}
      {!isLast && (
        <div
          aria-hidden="true"
          className="absolute left-4 top-8 -bottom-0 w-px bg-zinc-200 dark:bg-zinc-700"
        />
      )}

      {/* Icon */}
      <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
        {icon ?? <div className="size-2 rounded-full bg-zinc-400 dark:bg-zinc-500" />}
      </div>

      {/* Content */}
      <div className="flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">{title}</p>
          {date && (
            <time className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{date}</time>
          )}
        </div>
        {description && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
        )}
      </div>
    </li>
  );
}
