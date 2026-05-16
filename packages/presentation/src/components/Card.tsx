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
        // Bare `border` previously fell through to currentColor — visible bug.
        // Lighter than field borders (cards sit one tier behind interactive fields).
        'rounded-lg border border-zinc-200 dark:border-zinc-700 bg-card text-card-foreground shadow-sm hover:shadow-md',
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

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
