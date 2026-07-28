import { cn } from '../utils/cn.js';
import { resolveIntent, type Intent, type LegacyColorway } from '../utils/intent.js';

/** @deprecated Use `Intent` / the `intent` prop. Removed in 0.15. */
type ProgressColor = 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'zinc';

const intentFill: Record<Intent, string> = {
  brand: 'bg-primary',
  neutral: 'bg-surface-3',
  success: 'bg-success-strong',
  warning: 'bg-warning',
  danger: 'bg-destructive',
};

const legacyColorToIntent: Record<ProgressColor, Intent> = {
  blue: 'brand',
  violet: 'brand',
  green: 'success',
  red: 'danger',
  amber: 'warning',
  zinc: 'neutral',
};

export function Progress({
  value,
  max = 100,
  intent,
  color,
  size = 'md',
  label,
  showValue = false,
  className,
}: {
  value: number;
  max?: number;
  /** Semantic fill. Default `brand` (was palette `blue`). */
  intent?: Intent;
  /**
   * @deprecated Use `intent`. Maps blue→brand, green→success, red→danger,
   * amber→warning, violet→brand, zinc→neutral. Removed in 0.15.
   */
  color?: ProgressColor;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  label?: string;
  showValue?: boolean;
  className?: string;
}) {
  const resolved = resolveIntent({
    intent: intent ?? (color ? legacyColorToIntent[color] : undefined),
    color: color as LegacyColorway | undefined,
    component: 'Progress',
    defaultIntent: 'brand',
  });
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const heightClass = { xs: 'h-1', sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }[size];

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && <span className="text-sm font-medium text-body">{label}</span>}
          {showValue && (
            <span className="text-sm text-muted-foreground">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? 'Progress'}
        className={cn('w-full overflow-hidden rounded-full bg-surface-2', heightClass)}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-in-out',
            intentFill[resolved],
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
