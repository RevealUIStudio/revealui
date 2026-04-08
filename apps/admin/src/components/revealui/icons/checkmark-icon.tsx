import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

export function CheckmarkIcon({ className, ...props }: ComponentProps<'svg'>) {
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
        d="M12.416 3.376a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.97 2.97 6.97-6.97a.75.75 0 011.06 0z"
      />
    </svg>
  );
}
