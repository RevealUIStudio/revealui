import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn.js';

export interface ChoiceCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  selected?: boolean;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}

/**
 * Selectable wrapping card. Use this instead of `Button` when the control
 * contains a title, description, or chips. `Button` stays nowrap on purpose.
 */
export function ChoiceCard({
  selected = false,
  icon,
  title,
  description,
  children,
  className,
  type = 'button',
  ...props
}: ChoiceCardProps): ReactNode {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'flex h-auto min-w-0 w-full flex-col items-stretch whitespace-normal break-words rounded-[var(--rvui-radius-lg,16px)] border p-4 text-left text-sm font-normal',
        'transition-[color,background-color,border-color,box-shadow] duration-[var(--rvui-duration-normal)] ease-[var(--rvui-ease)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        selected
          ? 'border-border bg-muted ring-1 ring-ring'
          : 'border-border bg-card hover:border-border hover:shadow-md',
        className,
      )}
      {...props}
    >
      <span className="mb-1 flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate font-medium text-foreground text-sm">{title}</span>
      </span>
      {description ? (
        <span className="break-words text-xs font-normal leading-relaxed text-muted-foreground">
          {description}
        </span>
      ) : null}
      {children ? <span className="mt-2 flex flex-wrap gap-1">{children}</span> : null}
    </button>
  );
}
