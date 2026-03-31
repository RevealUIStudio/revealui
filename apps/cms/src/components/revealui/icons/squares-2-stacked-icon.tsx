import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

export function Squares2StackedIcon({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={cn('inline-block', className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.5 2.5a1 1 0 011-1h11a1 1 0 011 1v11a1 1 0 01-1 1h-11a1 1 0 01-1-1v-11zm1 0v11h11v-11h-11zm2.5 2.5a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1h-6a1 1 0 01-1-1v-6zm1 0v6h6v-6h-6z"
      />
    </svg>
  );
}
