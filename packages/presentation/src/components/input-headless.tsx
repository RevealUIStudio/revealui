import type React from 'react';
import { useDataInteractive } from '../hooks/use-data-interactive.js';
import { useFieldControlProps } from '../hooks/use-field-context.js';
import { cn } from '../utils/cn.js';

export function InputGroup({ children }: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      data-slot="control"
      className={cn(
        'relative isolate block',
        'has-[[data-slot=icon]:first-child]:[&_input]:pl-10 has-[[data-slot=icon]:last-child]:[&_input]:pr-10 sm:has-[[data-slot=icon]:first-child]:[&_input]:pl-8 sm:has-[[data-slot=icon]:last-child]:[&_input]:pr-8',
        '*:data-[slot=icon]:pointer-events-none *:data-[slot=icon]:absolute *:data-[slot=icon]:top-3 *:data-[slot=icon]:z-10 *:data-[slot=icon]:size-5 sm:*:data-[slot=icon]:top-2.5 sm:*:data-[slot=icon]:size-4',
        '[&>[data-slot=icon]:first-child]:left-3 sm:[&>[data-slot=icon]:first-child]:left-2.5 [&>[data-slot=icon]:last-child]:right-3 sm:[&>[data-slot=icon]:last-child]:right-2.5',
        '*:data-[slot=icon]:text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

const dateTypes = ['date', 'datetime-local', 'month', 'time', 'week'] as const;
type DateType = (typeof dateTypes)[number];

type InputProps = {
  className?: string;
  type?:
    | 'email'
    | 'file'
    | 'hidden'
    | 'number'
    | 'password'
    | 'search'
    | 'tel'
    | 'text'
    | 'url'
    | DateType;
  disabled?: boolean;
  invalid?: boolean;
  ref?: React.Ref<HTMLInputElement>;
} & Omit<React.ComponentPropsWithoutRef<'input'>, 'className' | 'type'>;

export function Input({ className, disabled, invalid, ref, ...props }: InputProps) {
  const interactiveProps = useDataInteractive({ disabled });
  const fieldProps = useFieldControlProps();

  if (props.type === 'hidden') {
    return <input ref={ref} disabled={disabled} className={className} {...props} />;
  }

  return (
    <span
      data-slot="control"
      className={cn([
        className,
        // Basic layout
        'relative block w-full',
        // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
        'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-card before:shadow-sm',
        // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo

        // Focus ring
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-ring',
        // Disabled state
        'has-data-disabled:opacity-50 has-data-disabled:before:bg-muted has-data-disabled:before:shadow-none',
      ])}
    >
      <input
        ref={ref}
        disabled={disabled}
        {...props}
        {...interactiveProps}
        {...fieldProps}
        data-invalid={invalid ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        className={cn([
          // Date classes
          props.type &&
            dateTypes.includes(props.type as DateType) && [
              '[&::-webkit-datetime-edit-fields-wrapper]:p-0',
              '[&::-webkit-date-and-time-value]:min-h-[1.5em]',
              '[&::-webkit-datetime-edit]:inline-flex',
              '[&::-webkit-datetime-edit]:p-0',
              '[&::-webkit-datetime-edit-year-field]:p-0',
              '[&::-webkit-datetime-edit-month-field]:p-0',
              '[&::-webkit-datetime-edit-day-field]:p-0',
              '[&::-webkit-datetime-edit-hour-field]:p-0',
              '[&::-webkit-datetime-edit-minute-field]:p-0',
              '[&::-webkit-datetime-edit-second-field]:p-0',
              '[&::-webkit-datetime-edit-millisecond-field]:p-0',
              '[&::-webkit-datetime-edit-meridiem-field]:p-0',
            ],
          // Basic layout
          'relative block w-full appearance-none rounded-lg px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
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
          'data-disabled:border-border data-hover:data-disabled:border-border',
          // System icons
        ])}
      />
    </span>
  );
}
