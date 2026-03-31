'use client';

import type React from 'react';
import { createContext, use, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/use-escape-key.js';
import { useFocusTrap } from '../hooks/use-focus-trap.js';
import { useScrollLock } from '../hooks/use-scroll-lock.js';
import { useTransition } from '../hooks/use-transition.js';
import { cn } from '../utils/cn.js';

const DrawerContext = createContext<string | undefined>(undefined);

type DrawerSide = 'left' | 'right' | 'top' | 'bottom';

const sideClasses: Record<DrawerSide, string> = {
  left: 'inset-y-0 left-0 h-full w-full max-w-sm data-closed:-translate-x-full',
  right: 'inset-y-0 right-0 h-full w-full max-w-sm data-closed:translate-x-full',
  top: 'inset-x-0 top-0 w-full max-h-[50vh] data-closed:-translate-y-full',
  bottom: 'inset-x-0 bottom-0 w-full max-h-[50vh] data-closed:translate-y-full',
};

export function Drawer({
  open,
  onClose,
  side = 'right',
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side?: DrawerSide;
  className?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const backdrop = useTransition(open);
  const panel = useTransition(open);

  useScrollLock(open);
  useFocusTrap(panelRef, open);
  useEscapeKey(onClose, open);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!(backdrop.mounted || panel.mounted)) return null;

  return createPortal(
    <DrawerContext.Provider value={titleId}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {backdrop.mounted && (
          <button
            type="button"
            aria-label="Close drawer"
            ref={backdrop.nodeRef as React.RefObject<HTMLButtonElement>}
            {...backdrop.transitionProps}
            onClick={handleBackdropClick}
            className="fixed inset-0 z-40 bg-zinc-950/25 transition duration-200 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in dark:bg-zinc-950/50"
          />
        )}
        {panel.mounted && (
          <div
            ref={(node) => {
              (panelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
              (panel.nodeRef as React.MutableRefObject<HTMLElement | null>).current = node;
            }}
            {...panel.transitionProps}
            className={cn(
              'fixed z-50 overflow-y-auto bg-white shadow-xl ring-1 ring-zinc-950/10 transition duration-300 ease-in-out dark:bg-zinc-900 dark:ring-white/10',
              sideClasses[side],
              className,
            )}
          >
            {children}
          </div>
        )}
      </div>
    </DrawerContext.Provider>,
    document.body,
  );
}

export function DrawerHeader({
  onClose,
  className,
  children,
}: {
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const titleId = use(DrawerContext);
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700',
        className,
      )}
    >
      <h2 id={titleId} className="text-base font-semibold text-zinc-950 dark:text-white">
        {children}
      </h2>
      {onClose && (
        <button
          type="button"
          aria-label="Close drawer"
          onClick={onClose}
          className="rounded-md p-1 text-zinc-400 hover:text-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:hover:text-zinc-200"
        >
          <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export function DrawerBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={cn('px-6 py-4', className)} />;
}

export function DrawerFooter({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn(
        'flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4 dark:border-zinc-700',
        className,
      )}
    />
  );
}
