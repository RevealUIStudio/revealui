import type React from 'react';
import {
  FieldProvider,
  useFieldDescriptionProps,
  useFieldErrorProps,
  useFieldLabelProps,
} from '../hooks/use-field-context.js';
import { cn } from '../utils/cn.js';

export function Fieldset({
  className,
  disabled,
  ...props
}: { className?: string; disabled?: boolean } & Omit<
  React.ComponentPropsWithoutRef<'fieldset'>,
  'className'
>) {
  return (
    <fieldset
      disabled={disabled}
      {...props}
      className={cn(className, '*:data-[slot=text]:mt-1 [&>*+[data-slot=control]]:mt-6')}
    />
  );
}

export function Legend({
  className,
  ...props
}: { className?: string } & Omit<React.ComponentPropsWithoutRef<'legend'>, 'className'>) {
  return (
    <legend
      data-slot="legend"
      {...props}
      className={cn(
        className,
        'text-base/6 font-semibold text-zinc-950 data-disabled:opacity-50 sm:text-sm/6 dark:text-white',
      )}
    />
  );
}

export function FieldGroup({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div data-slot="control" {...props} className={cn(className, 'space-y-8')} />;
}

export function Field({
  className,
  disabled,
  ...props
}: {
  className?: string;
  disabled?: boolean;
} & Omit<React.ComponentPropsWithoutRef<'div'>, 'className'>) {
  return (
    <FieldProvider disabled={disabled}>
      <div
        {...props}
        data-disabled={disabled ? '' : undefined}
        className={cn(
          className,
          '[&>[data-slot=label]+[data-slot=control]]:mt-3',
          '[&>[data-slot=label]+[data-slot=description]]:mt-1',
          '[&>[data-slot=description]+[data-slot=control]]:mt-3',
          '[&>[data-slot=control]+[data-slot=description]]:mt-3',
          '[&>[data-slot=control]+[data-slot=error]]:mt-3',
          '*:data-[slot=label]:font-medium',
        )}
      />
    </FieldProvider>
  );
}

export function Label({
  className,
  ...props
}: { className?: string } & Omit<React.ComponentPropsWithoutRef<'label'>, 'className'>) {
  const fieldLabelProps = useFieldLabelProps();

  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor provided via useFieldLabelProps hook
    <label
      data-slot="label"
      {...fieldLabelProps}
      {...props}
      className={cn(
        className,
        'text-base/6 text-zinc-950 select-none data-disabled:opacity-50 sm:text-sm/6 dark:text-white',
      )}
    />
  );
}

export function Description({
  className,
  ...props
}: { className?: string } & Omit<React.ComponentPropsWithoutRef<'p'>, 'className'>) {
  const fieldDescriptionProps = useFieldDescriptionProps();

  return (
    <p
      data-slot="description"
      {...fieldDescriptionProps}
      {...props}
      className={cn(
        className,
        'text-base/6 text-zinc-500 data-disabled:opacity-50 sm:text-sm/6 dark:text-zinc-400',
      )}
    />
  );
}

export function ErrorMessage({
  className,
  ...props
}: { className?: string } & Omit<React.ComponentPropsWithoutRef<'p'>, 'className'>) {
  const fieldErrorProps = useFieldErrorProps();

  return (
    <p
      data-slot="error"
      {...fieldErrorProps}
      {...props}
      className={cn(
        className,
        'text-base/6 text-red-600 data-disabled:opacity-50 sm:text-sm/6 dark:text-red-500',
      )}
    />
  );
}
