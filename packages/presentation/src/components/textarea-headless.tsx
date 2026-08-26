import type React from 'react';
import { useDataInteractive } from '../hooks/use-data-interactive.js';
import { useFieldControlProps } from '../hooks/use-field-context.js';
import { cn } from '../utils/cn.js';
import { focusRingAfterWithin } from '../utils/focus.js';

type TextareaProps = {
  className?: string;
  resizable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  ref?: React.Ref<HTMLTextAreaElement>;
} & Omit<React.ComponentPropsWithoutRef<'textarea'>, 'className'>;

export function Textarea({
  className,
  resizable = true,
  disabled,
  invalid,
  ref,
  ...props
}: TextareaProps) {
  const interactiveProps = useDataInteractive({ disabled });
  const fieldProps = useFieldControlProps();

  return (
    <span
      data-slot="control"
      className={cn([
        className,
        // Basic layout
        'relative block w-full',
        // Surface on ::before so the token card fill blends with the border
        'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-card before:shadow-sm',
        // Focus ring
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset',
        focusRingAfterWithin,
        // Disabled state
        'has-data-disabled:opacity-50 has-data-disabled:before:bg-muted has-data-disabled:before:shadow-none',
      ])}
    >
      <textarea
        ref={ref}
        disabled={disabled}
        {...props}
        {...interactiveProps}
        {...fieldProps}
        data-invalid={invalid ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        className={cn([
          // Basic layout
          'relative block h-full w-full appearance-none rounded-lg px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
          // Typography
          'text-base/6 text-foreground placeholder:text-muted-foreground sm:text-sm/6',
          // Border
          'border border-input data-hover:border-input',
          // Background color
          'bg-transparent',
          // Hide default focus styles
          'focus:outline-hidden',
          // Invalid state
          'data-invalid:border-destructive data-invalid:data-hover:border-destructive',
          // Disabled state
          'disabled:border-border data-hover:disabled:border-border',
          // Resizable
          resizable ? 'resize-y' : 'resize-none',
        ])}
      />
    </span>
  );
}
