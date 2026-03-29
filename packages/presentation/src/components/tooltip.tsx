'use client';

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../utils/cn.js';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

const sideClasses: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

type TooltipProps = {
  content: ReactNode;
  side?: TooltipSide;
  className?: string;
  delay?: number;
  children: ReactNode;
};

export function Tooltip({ content, side = 'top', className, delay = 200, children }: TooltipProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clear();
    timeoutRef.current = window.setTimeout(() => {
      setVisible(true);
    }, delay);
  }, [delay, clear]);

  const hide = useCallback(() => {
    clear();
    setVisible(false);
  }, [clear]);

  useEffect(() => {
    return clear;
  }, [clear]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Tooltip triggers need pointer and focus listeners while still allowing arbitrary inline children.
    <span
      className="relative inline-flex"
      onPointerEnter={show}
      onPointerLeave={hide}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={visible ? id : undefined}
    >
      {children}

      {visible && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 w-max max-w-xs rounded-lg bg-zinc-950 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-zinc-700',
            sideClasses[side],
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
