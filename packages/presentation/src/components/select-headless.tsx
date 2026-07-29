import type React from 'react';
import { useDataInteractive } from '../hooks/use-data-interactive.js';
import { useFieldControlProps } from '../hooks/use-field-context.js';
import { cn } from '../utils/cn.js';

type SelectProps = {
  className?: string;
  multiple?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  ref?: React.Ref<HTMLSelectElement>;
} & Omit<React.ComponentPropsWithoutRef<'select'>, 'className'>;

export function Select({ className, multiple, disabled, invalid, ref, ...props }: SelectProps) {
  const interactiveProps = useDataInteractive({ disabled });
  const fieldProps = useFieldControlProps();

  return (
    <span
      data-slot="control"
      className={cn([
        className,
        // Basic layout
        'group relative block w-full',
        // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
        'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-card before:shadow-sm',
        // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo

        // Focus ring
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset has-data-focus:after:ring-2 has-data-focus:after:ring-ring',
        // Disabled state
        'has-data-disabled:opacity-50 has-data-disabled:before:bg-muted has-data-disabled:before:shadow-none',
      ])}
    >
      <select
        ref={ref}
        multiple={multiple}
        disabled={disabled}
        {...props}
        {...interactiveProps}
        {...fieldProps}
        data-invalid={invalid ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        className={cn([
          // Basic layout
          'relative block w-full appearance-none rounded-lg py-[calc(--spacing(2.5)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
          // Horizontal padding
          multiple
            ? 'px-[calc(--spacing(3.5)-1px)] sm:px-[calc(--spacing(3)-1px)]'
            : 'pr-[calc(--spacing(10)-1px)] pl-[calc(--spacing(3.5)-1px)] sm:pr-[calc(--spacing(9)-1px)] sm:pl-[calc(--spacing(3)-1px)]',
          // Options (multi-select)
          '[&_optgroup]:font-semibold',
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
          'data-disabled:border-border data-disabled:opacity-100 data-hover:data-disabled:border-border',
        ])}
      />
      {!multiple && (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <svg
            className="size-5 stroke-muted-foreground group-has-data-disabled:stroke-muted-foreground sm:size-4 forced-colors:stroke-[CanvasText]"
            viewBox="0 0 16 16"
            aria-hidden="true"
            fill="none"
          >
            <path
              d="M5.75 10.75L8 13L10.25 10.75"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10.25 5.25L8 3L5.75 5.25"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </span>
  );
}
