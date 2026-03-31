import { cn } from '../utils/cn.js';

type ProgressColor = 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'zinc';

const trackClasses: Record<ProgressColor, string> = {
  blue: 'bg-blue-600 dark:bg-blue-500',
  green: 'bg-green-600 dark:bg-green-500',
  red: 'bg-red-600 dark:bg-red-500',
  amber: 'bg-amber-500 dark:bg-amber-400',
  violet: 'bg-violet-600 dark:bg-violet-500',
  zinc: 'bg-zinc-600 dark:bg-zinc-400',
};

export function Progress({
  value,
  max = 100,
  color = 'blue',
  size = 'md',
  label,
  showValue = false,
  className,
}: {
  value: number;
  max?: number;
  color?: ProgressColor;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  label?: string;
  showValue?: boolean;
  className?: string;
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const heightClass = { xs: 'h-1', sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }[size];

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && (
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
          )}
          {showValue && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? 'Progress'}
        className={cn(
          'w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700',
          heightClass,
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-in-out',
            trackClasses[color],
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
