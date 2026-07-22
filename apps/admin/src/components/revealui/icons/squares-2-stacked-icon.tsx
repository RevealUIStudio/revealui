import { IconCopy } from '@revealui/presentation/server';
import type { ComponentProps } from 'react';

export function Squares2StackedIcon({ className, ...props }: ComponentProps<'svg'>) {
  return <IconCopy size="sm" className={className} aria-hidden="true" {...props} />;
}
