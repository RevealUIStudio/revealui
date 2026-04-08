import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

export function Text({
  children,
  className,
  size = 'md',
  ...props
}: ComponentProps<'div'> & { size?: 'md' | 'lg' }) {
  return (
    <div
      className={cn(
        size === 'md' && 'text-base/7',
        size === 'lg' && 'text-lg/8',
        'text-mist-700 dark:text-mist-400',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
