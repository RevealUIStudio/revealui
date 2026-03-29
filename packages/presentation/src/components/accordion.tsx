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
  return (
    <div className={cn('divide-y divide-zinc-200 dark:divide-zinc-700', className)}>{children}</div>
  );
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
        className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-zinc-950 transition-colors hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-white dark:hover:text-zinc-300"
      >
        <span>{title}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          className={cn(
            'size-4 shrink-0 text-zinc-400 transition-transform duration-200',
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
      {open && (
        <section
          id={`${id}-content`}
          aria-labelledby={`${id}-trigger`}
          className="pb-4 text-sm text-zinc-600 dark:text-zinc-400"
        >
          {children}
        </section>
      )}
    </div>
  );
}
