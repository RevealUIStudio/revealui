'use client';

import clsx from 'clsx';
import type React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

const sideClasses: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({
  content,
  side = 'top',
  className,
  children,
}: {
  content: React.ReactNode;
  side?: TooltipSide;
  className?: string;
  children: React.ReactElement;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), 200);
  }, []);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          id={id}
          className={clsx(
            className,
            sideClasses[side],
            'pointer-events-none absolute z-50 w-max max-w-xs rounded-lg bg-zinc-950 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-zinc-700',
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
