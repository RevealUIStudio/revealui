import type React from 'react';
import { cn } from '../utils/cn.js';
import { FormLabel } from './FormLabel.js';

export interface FormFieldProps {
  /** Unique ID linking label to input  -  must match the input's `id` prop */
  id: string;
  /** Label text */
  label: string;
  /** Error message  -  when set, field shows error styling */
  error?: string;
  /** Helper text shown below the input */
  description?: string;
  /** Show required asterisk on label */
  required?: boolean;
  /** Additional class on wrapper */
  className?: string;
  /** The input/select/textarea element */
  children: React.ReactNode;
}

function FormField({
  id,
  label,
  error,
  description,
  required,
  className,
  children,
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <FormLabel htmlFor={id} required={required}>
        {label}
      </FormLabel>
      {children}
      {description && !error && (
        <p id={descriptionId} className="text-xs text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

FormField.displayName = 'FormField';

export { FormField };
