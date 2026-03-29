import { cn } from '../utils/cn.js';
import { Avatar } from './avatar.js';

type AvatarGroupItem = {
  src?: string | null;
  initials?: string;
  alt?: string;
};

export function AvatarGroup({
  items,
  max = 5,
  size = 'md',
  className,
}: {
  items: AvatarGroupItem[];
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = { xs: 'size-6', sm: 'size-8', md: 'size-10', lg: 'size-12' };
  const overlapClass = { xs: '-ml-1.5', sm: '-ml-2', md: '-ml-3', lg: '-ml-4' };

  const visible = items.slice(0, max);
  const overflow = items.length - max;

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((item, i) => {
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: avatar items are positionally ordered with no stable ID
            key={i}
            className={cn(
              'ring-2 ring-white dark:ring-zinc-900',
              sizeClasses[size],
              i > 0 && overlapClass[size],
              'rounded-full',
            )}
          >
            <Avatar
              src={item.src}
              initials={item.initials}
              alt={item.alt ?? ''}
              className="size-full"
            />
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          className={cn(
            overlapClass[size],
            sizeClasses[size],
            'flex items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 ring-2 ring-white dark:bg-zinc-700 dark:text-zinc-300 dark:ring-zinc-900',
          )}
          role="img"
          aria-label={`${overflow} more`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
