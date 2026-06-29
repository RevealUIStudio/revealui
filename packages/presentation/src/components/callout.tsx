import type React from 'react';
import { cn } from '../utils/cn.js';

type CalloutVariant = 'info' | 'warning' | 'error' | 'success' | 'tip';

const variantStyles: Record<CalloutVariant, { wrapper: string; icon: string; iconChar: string }> = {
  info: {
    wrapper: 'bg-primary/10 ring-primary/20',
    icon: 'text-primary',
    iconChar: 'i',
  },
  warning: {
    wrapper: 'bg-warning/10 ring-warning/20',
    icon: 'text-warning-foreground',
    iconChar: '!',
  },
  error: {
    wrapper: 'bg-error/10 ring-error/20',
    icon: 'text-error',
    iconChar: '✕',
  },
  success: {
    wrapper: 'bg-success/10 ring-success/20',
    icon: 'text-success',
    iconChar: '✓',
  },
  tip: {
    wrapper: 'bg-accent/10 ring-accent/20',
    icon: 'text-accent-foreground',
    iconChar: '★',
  },
};

export function Callout({
  variant = 'info',
  title,
  icon,
  role = 'note',
  className,
  children,
}: {
  variant?: CalloutVariant;
  title?: string;
  icon?: React.ReactNode;
  /** ARIA role. Default 'note'; use 'status'/'alert' for live status banners. */
  role?: 'note' | 'status' | 'alert';
  className?: string;
  children: React.ReactNode;
}) {
  const styles = variantStyles[variant];

  return (
    <div role={role} className={cn('rounded-xl p-4 ring-1', styles.wrapper, className)}>
      <div className="flex gap-3">
        <span className={cn('mt-0.5 shrink-0 text-sm font-bold', styles.icon)} aria-hidden="true">
          {icon ?? styles.iconChar}
        </span>
        <div className="min-w-0 flex-1">
          {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
          <div className={cn('text-sm text-muted-foreground', title && 'mt-1')}>{children}</div>
        </div>
      </div>
    </div>
  );
}
