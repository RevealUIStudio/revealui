'use client';

import type React from 'react';
import { useId, useState } from 'react';
import { cn } from '../utils/cn.js';

export function Accordion({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('divide-y divide-border', className)}>{children}</div>;
}

export function AccordionItem({
  title,
  defaultOpen = false,
  className,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className={className}>
      <button
        type="button"
        id={`${id}-trigger`}
        aria-expanded={open}
        aria-controls={`${id}-content`}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-foreground transition-colors hover:text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span>{title}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {/* Keep panel mounted so consumers (CMS fieldAttrs, SSR text) stay in the DOM. */}
      <section
        id={`${id}-content`}
        aria-labelledby={`${id}-trigger`}
        hidden={!open}
        className={cn('pb-4 text-sm text-body', !open && 'hidden')}
      >
        {children}
      </section>
    </div>
  );
}
