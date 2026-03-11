import clsx from 'clsx';
import type React from 'react';

type TrendDirection = 'up' | 'down' | 'neutral';

export function Stat({
  label,
  value,
  change,
  trend,
  description,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  change?: string;
  trend?: TrendDirection;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const trendColor = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-zinc-500 dark:text-zinc-400',
  };

  const trendArrow = { up: '↑', down: '↓', neutral: '→' };

  return (
    <div
      className={clsx(
        'rounded-xl bg-white p-6 ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
        {icon && <div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">{icon}</div>}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
        {value}
      </p>
      {(change || description) && (
        <div className="mt-2 flex items-center gap-2">
          {change && trend && (
            <span className={clsx('text-sm font-medium', trendColor[trend])}>
              {trendArrow[trend]} {change}
            </span>
          )}
          {description && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function StatGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {children}
    </div>
  );
}
