import type React from 'react';
import { cn } from '../utils/cn.js';

export type BreadcrumbItem = {
  label: React.ReactNode;
  href?: string;
};

export function Breadcrumb({
  items,
  separator,
  className,
}: {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  className?: string;
}) {
  const sep = separator ?? (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      className="size-3.5 text-muted-foreground"
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <nav aria-label="Breadcrumb">
      <ol className={cn('flex flex-wrap items-center gap-1.5 text-sm', className)}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: breadcrumb items are positionally ordered with no stable ID
            <li key={index} className="flex items-center gap-1.5">
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn(isLast ? 'font-medium text-foreground' : 'text-muted-foreground')}
                >
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              )}
              {!isLast && sep}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
