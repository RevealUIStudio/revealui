'use client';

import type React from 'react';
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/use-escape-key.js';
import { useFocusTrap } from '../hooks/use-focus-trap.js';
import { useScrollLock } from '../hooks/use-scroll-lock.js';
import { useTransition } from '../hooks/use-transition.js';
import { cn } from '../utils/cn.js';
import { Text } from './text.js';

const sizes = {
  xs: 'sm:max-w-xs',
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl',
};

export function Alert({
  size = 'md',
  className,
  children,
  open,
  onClose,
}: {
  size?: keyof typeof sizes;
  className?: string;
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const backdrop = useTransition(open);
  const panel = useTransition(open);

  useScrollLock(open);
  useFocusTrap(panelRef, open);
  useEscapeKey(onClose, open);

  if (!(backdrop.mounted || panel.mounted)) return null;

  return createPortal(
    <div role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
      {/* Backdrop */}
      {backdrop.mounted && (
        <button
          type="button"
          aria-label="Close alert"
          ref={backdrop.nodeRef as React.RefObject<HTMLButtonElement>}
          {...backdrop.transitionProps}
          onClick={onClose}
          className="fixed inset-0 flex w-screen justify-center overflow-y-auto bg-zinc-950/15 px-2 py-2 transition duration-100 focus:outline-0 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in sm:px-6 sm:py-8 lg:px-8 lg:py-16 dark:bg-zinc-950/50"
        />
      )}

      {/* Panel container */}
      {panel.mounted && (
        <div className="fixed inset-0 w-screen overflow-y-auto pt-6 sm:pt-0">
          <div className="grid min-h-full grid-rows-[1fr_auto_1fr] justify-items-center p-8 sm:grid-rows-[1fr_auto_3fr] sm:p-4">
            <div
              ref={(node) => {
                (panelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                (panel.nodeRef as React.MutableRefObject<HTMLElement | null>).current = node;
              }}
              {...panel.transitionProps}
              className={cn(
                className,
                sizes[size],
                'row-start-2 w-full rounded-2xl bg-white p-8 shadow-lg ring-1 ring-zinc-950/10 sm:rounded-2xl sm:p-6 dark:bg-zinc-900 dark:ring-white/10 forced-colors:outline',
                'transition duration-100 will-change-transform data-closed:opacity-0 data-enter:ease-out data-closed:data-enter:scale-95 data-leave:ease-in',
              )}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

export function AlertTitle({
  className,
  ...props
}: { className?: string } & React.ComponentPropsWithoutRef<'h2'>) {
  return (
    <h2
      {...props}
      className={cn(
        className,
        'text-center text-base/6 font-semibold text-balance text-zinc-950 sm:text-left sm:text-sm/6 sm:text-wrap dark:text-white',
      )}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: { className?: string } & React.ComponentPropsWithoutRef<typeof Text>) {
  return <Text {...props} className={cn(className, 'mt-2 text-center text-pretty sm:text-left')} />;
}

export function AlertBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={cn(className, 'mt-4')} />;
}

export function AlertActions({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn(
        className,
        'mt-6 flex flex-col-reverse items-center justify-end gap-3 *:w-full sm:mt-4 sm:flex-row sm:*:w-auto',
      )}
    />
  );
}
