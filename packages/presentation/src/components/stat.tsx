import type React from 'react';
import { cn } from '../utils/cn.js';

type TrendDirection = 'up' | 'down' | 'neutral';

const trendStyles: Record<TrendDirection, React.CSSProperties> = {
  up: { color: 'var(--rvui-success, oklch(0.72 0.17 155))' },
  down: { color: 'var(--rvui-error, oklch(0.65 0.2 25))' },
  neutral: { color: 'var(--rvui-text-2, oklch(0.55 0.012 218))' },
};

const trendArrow = { up: '↑', down: '↓', neutral: '→' };

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
  return (
    <div
      className={cn('rounded-xl p-6 ring-1', className)}
      style={
        {
          backgroundColor: 'var(--rvui-surface-1, oklch(0.18 0.006 225))',
          '--tw-ring-color': 'var(--rvui-border-subtle, oklch(0.28 0.006 222 / 0.4))',
          borderRadius: 'var(--rvui-radius-lg, 16px)',
          transition:
            'box-shadow var(--rvui-duration-normal, 200ms) var(--rvui-ease, cubic-bezier(0.22, 1, 0.36, 1))',
        } as React.CSSProperties
      }
    >
      <div className="flex items-start justify-between">
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--rvui-text-2, oklch(0.55 0.012 218))' }}
        >
          {label}
        </p>
        {icon && (
          <div
            className="rounded-lg p-2"
            style={{ backgroundColor: 'var(--rvui-surface-2, oklch(0.22 0.008 222))' }}
          >
            {icon}
          </div>
        )}
      </div>
      <p
        className="mt-2 text-3xl font-semibold tracking-tight"
        style={{ color: 'var(--rvui-text-0, oklch(0.95 0.002 210))' }}
      >
        {value}
      </p>
      {(change || description) && (
        <div className="mt-2 flex items-center gap-2">
          {change && trend && (
            <span className="text-sm font-medium" style={trendStyles[trend]}>
              {trendArrow[trend]} {change}
            </span>
          )}
          {description && (
            <span
              className="text-sm"
              style={{ color: 'var(--rvui-text-2, oklch(0.55 0.012 218))' }}
            >
              {description}
            </span>
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
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {children}
    </div>
  );
}
