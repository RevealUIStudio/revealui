import { IconArrowRight } from '@revealui/presentation/server';
import type { ComponentProps } from 'react';

export function ArrowNarrowRightIcon({ className, ...props }: ComponentProps<'svg'>) {
  return <IconArrowRight size="sm" className={className} aria-hidden="true" {...props} />;
}
