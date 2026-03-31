import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

export function Main({ children, className, ...props }: ComponentProps<'main'>) {
  return (
    <main className={cn('isolate overflow-clip', className)} {...props}>
      {children}
    </main>
  );
}
