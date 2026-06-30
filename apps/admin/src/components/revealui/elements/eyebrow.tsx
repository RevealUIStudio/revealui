import { cn } from '@revealui/presentation/server';
import type { ComponentProps } from 'react';

export function Eyebrow({ children, className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('text-sm/7 font-semibold text-mist-700 dark:text-mist-400', className)}
      {...props}
    >
      {children}
    </div>
  );
}
