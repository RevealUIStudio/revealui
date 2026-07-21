import { IconCheck } from '@revealui/presentation/server';
import type { ComponentProps } from 'react';

export function CheckmarkIcon({ className, ...props }: ComponentProps<'svg'>) {
  return <IconCheck size="sm" className={className} aria-hidden="true" {...props} />;
}
