import { cn } from '@revealui/presentation/server';
import type { ComponentProps } from 'react';

export function Main({ children, className, ...props }: ComponentProps<'main'>) {
  return (
    <main className={cn('isolate overflow-clip', className)} {...props}>
      {children}
    </main>
  );
}
