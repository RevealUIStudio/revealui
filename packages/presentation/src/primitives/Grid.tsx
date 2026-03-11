import type React from 'react';
import { cn } from '../utils/cn.js';

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: number | string;
  rows?: number | string;
  gap?: number | string;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Grid primitive - CSS Grid container component
 */
function Grid({ cols, rows, gap, className, style, ref, ...props }: GridProps) {
  const gridStyle: React.CSSProperties = {
    ...style,
    ...(cols && {
      gridTemplateColumns: typeof cols === 'number' ? `repeat(${cols}, 1fr)` : cols,
    }),
    ...(rows && {
      gridTemplateRows: typeof rows === 'number' ? `repeat(${rows}, 1fr)` : rows,
    }),
    ...(gap && { gap: typeof gap === 'number' ? `${gap}px` : gap }),
  };

  return <div ref={ref} className={cn('grid', className)} style={gridStyle} {...props} />;
}

export { Grid };
