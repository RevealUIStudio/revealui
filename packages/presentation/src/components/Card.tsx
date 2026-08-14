import type React from 'react';
import { cn } from '../utils/cn.js';

function Card({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      className={cn(
        // Token-driven card border (was a Catalyst palette holdover). `border-border`
        // resolves via --rvui-border and auto-adapts to light/dark; cards sit one tier
        // behind interactive fields, which the border token already accounts for.
        'rounded-lg border border-border bg-card text-card-foreground shadow-sm hover:shadow-md',
        className,
      )}
      style={{
        borderRadius: 'var(--rvui-radius-lg, 16px)',
        transition:
          'box-shadow var(--rvui-duration-normal, 200ms) var(--rvui-ease, cubic-bezier(0.22, 1, 0.36, 1))',
      }}
      ref={ref}
      {...props}
    />
  );
}

function CardHeader({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} ref={ref} {...props} />;
}

function CardTitle({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { ref?: React.Ref<HTMLParagraphElement> }) {
  return (
    <h3
      className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
      ref={ref}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { ref?: React.Ref<HTMLParagraphElement> }) {
  return <p className={cn('text-sm text-muted-foreground', className)} ref={ref} {...props} />;
}

function CardContent({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div className={cn('p-6 pt-0', className)} ref={ref} {...props} />;
}

function CardFooter({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div className={cn('flex items-center p-6 pt-0', className)} ref={ref} {...props} />;
}

export interface ChoiceCardProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  selected?: boolean;
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
}

/**
 * Selectable wrapping card. Use this instead of `Button` when the control
 * contains a title, description, or chips. `Button` stays nowrap on purpose.
 */
function ChoiceCard({
  selected = false,
  icon,
  title,
  description,
  children,
  className,
  type = 'button',
  ...props
}: ChoiceCardProps): React.ReactNode {
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

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, ChoiceCard };
