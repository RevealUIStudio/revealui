import type React from 'react';
import { cn } from '../utils/cn.js';

type CalloutVariant = 'info' | 'warning' | 'error' | 'success' | 'tip';

const variantStyles: Record<CalloutVariant, { wrapper: string; icon: string; iconChar: string }> = {
  info: {
    wrapper: 'bg-blue-50 ring-blue-200 dark:bg-blue-950/30 dark:ring-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    iconChar: 'i',
  },
  warning: {
    wrapper: 'bg-amber-50 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-800',
    icon: 'text-amber-600 dark:text-amber-400',
    iconChar: '!',
  },
  error: {
    wrapper: 'bg-red-50 ring-red-200 dark:bg-red-950/30 dark:ring-red-800',
    icon: 'text-red-600 dark:text-red-400',
    iconChar: '✕',
  },
  success: {
    wrapper: 'bg-green-50 ring-green-200 dark:bg-green-950/30 dark:ring-green-800',
    icon: 'text-green-600 dark:text-green-400',
    iconChar: '✓',
  },
  tip: {
    wrapper: 'bg-violet-50 ring-violet-200 dark:bg-violet-950/30 dark:ring-violet-800',
    icon: 'text-violet-600 dark:text-violet-400',
    iconChar: '★',
  },
};

export function Callout({
  variant = 'info',
  title,
  icon,
  className,
  children,
}: {
  variant?: CalloutVariant;
  title?: string;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const styles = variantStyles[variant];

  return (
    <div role="note" className={cn('rounded-xl p-4 ring-1', styles.wrapper, className)}>
      <div className="flex gap-3">
        <span className={cn('mt-0.5 shrink-0 text-sm font-bold', styles.icon)} aria-hidden="true">
          {icon ?? styles.iconChar}
        </span>
        <div className="min-w-0 flex-1">
          {title && <p className="text-sm font-semibold text-zinc-950 dark:text-white">{title}</p>}
          <div className={cn('text-sm text-zinc-700 dark:text-zinc-300', title && 'mt-1')}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
