'use client';

import clsx from 'clsx';
import type React from 'react';
import { createContext, use, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/use-escape-key.js';
import { useFocusTrap } from '../hooks/use-focus-trap.js';
import { useScrollLock } from '../hooks/use-scroll-lock.js';
import { useTransition } from '../hooks/use-transition.js';
import { Text } from './text.js';

const DialogContext = createContext<string | undefined>(undefined);

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

export function Dialog({
  size = 'lg',
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
    <DialogContext.Provider value={titleId}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {/* Backdrop */}
        {backdrop.mounted && (
          <button
            type="button"
            aria-label="Close dialog"
            ref={backdrop.nodeRef as React.RefObject<HTMLButtonElement>}
            {...backdrop.transitionProps}
            onClick={onClose}
            className="fixed inset-0 flex w-screen justify-center overflow-y-auto px-2 py-2 transition duration-100 focus:outline-0 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in sm:px-6 sm:py-8 lg:px-8 lg:py-16"
            style={{
              backgroundColor: 'oklch(0.13 0.004 228 / 0.6)',
              backdropFilter: 'blur(4px)',
            }}
          />
        )}

        {/* Panel container */}
        {panel.mounted && (
          <div className="fixed inset-0 w-screen overflow-y-auto pt-6 sm:pt-0">
            <div className="grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4">
              <div
                ref={(node) => {
                  // Combine refs
                  (panelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                  (panel.nodeRef as React.MutableRefObject<HTMLElement | null>).current = node;
                }}
                {...panel.transitionProps}
                className={clsx(
                  className,
                  sizes[size],
                  'row-start-2 w-full min-w-0 rounded-t-3xl p-(--gutter) shadow-lg ring-1 [--gutter:--spacing(8)] sm:mb-auto sm:rounded-2xl forced-colors:outline',
                  'transition will-change-transform data-closed:translate-y-12 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in sm:data-closed:translate-y-0 sm:data-closed:data-enter:scale-95',
                )}
                style={
                  {
                    backgroundColor: 'var(--rvui-surface-1, oklch(0.18 0.006 225))',
                    boxShadow: 'var(--rvui-shadow-lg, 0 12px 40px oklch(0 0 0 / 0.35))',
                    '--tw-ring-color': 'var(--rvui-border-subtle, oklch(0.28 0.006 222 / 0.4))',
                    transitionDuration: 'var(--rvui-duration-normal, 200ms)',
                    transitionTimingFunction:
                      'var(--rvui-ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1))',
                  } as React.CSSProperties
                }
              >
                {children}
              </div>
            </div>
          </div>
        )}
      </div>
    </DialogContext.Provider>,
    document.body,
  );
}

export function DialogTitle({
  className,
  ...props
}: { className?: string } & React.ComponentPropsWithoutRef<'h2'>) {
  const titleId = use(DialogContext);
  return (
    <h2
      id={titleId}
      {...props}
      className={clsx(className, 'text-lg/6 font-semibold text-balance sm:text-base/6')}
      style={{ color: 'var(--rvui-text-0, oklch(0.95 0.002 210))' }}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: { className?: string } & React.ComponentPropsWithoutRef<typeof Text>) {
  return <Text {...props} className={clsx(className, 'mt-2 text-pretty')} />;
}

export function DialogBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx(className, 'mt-6')} />;
}

export function DialogActions({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'mt-8 flex flex-col-reverse items-center justify-end gap-3 *:w-full sm:flex-row sm:*:w-auto',
      )}
    />
  );
}
