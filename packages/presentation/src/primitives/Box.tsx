import type React from 'react';
import { cn } from '../utils/cn.js';

export interface BoxProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'span' | 'section' | 'article' | 'header' | 'footer' | 'main' | 'aside' | 'nav';
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Box primitive - Basic container component
 */
function Box({ as: Component = 'div', className, ref, ...props }: BoxProps) {
  return <Component ref={ref} className={cn(className)} {...props} />;
}

export { Box };
