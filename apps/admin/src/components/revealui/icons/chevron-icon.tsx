import { IconChevronRight } from '@revealui/presentation/server';
import type { ComponentProps } from 'react';

export function ChevronIcon({ className, ...props }: ComponentProps<'svg'>) {
  return <IconChevronRight size="xs" className={className} aria-hidden="true" {...props} />;
}
