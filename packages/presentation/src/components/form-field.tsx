import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../utils/cn.js';
import { FormLabel } from './FormLabel.js';

export interface FormFieldProps {
  /** Unique ID linking label to input. Must match the input's `id` prop. */
  id: string;
  /** Label text */
  label: string;
  /** Error message. When set, the field shows error styling and aria-invalid. */
  error?: string;
  /**
   * Marks the control invalid when the message lives in `description`
   * (for example a live checklist) instead of `error`.
   */
  invalid?: boolean;
  /** Helper text or custom hint. Strings render in a paragraph. */
  description?: ReactNode;
  /**
   * Keep `description` visible when `error` is set.
   * Defaults to false so existing fields still replace helper text with the error.
   */
  keepDescription?: boolean;
  /** Show required asterisk on label */
  required?: boolean;
  /** Additional class on wrapper */
  className?: string;
  /** The input, select, or textarea. A single element receives aria attributes. */
  children: ReactNode;
}

function describedByTokens(value: string | undefined): string[] {
  if (!value) return [];
  const tokens: string[] = [];
  for (const part of value.split(' ')) {
    if (part.length > 0 && !tokens.includes(part)) tokens.push(part);
  }
  return tokens;
}

function joinDescribedBy(
  existing: string | undefined,
  next: string | undefined,
): string | undefined {
  const tokens = describedByTokens(existing);
  for (const part of describedByTokens(next)) {
    if (!tokens.includes(part)) tokens.push(part);
  }
  return tokens.length > 0 ? tokens.join(' ') : undefined;
}

function enhanceControl(
  children: ReactNode,
  describedBy: string | undefined,
  isInvalid: boolean,
): ReactNode {
  if (!isValidElement(children) || children.type === Fragment) return children;
  const child = children as ReactElement<{
    'aria-describedby'?: string;
    'aria-invalid'?: boolean | 'true' | 'false';
  }>;
  const described = joinDescribedBy(child.props['aria-describedby'], describedBy);
  const next: {
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  } = {};
  if (described) next['aria-describedby'] = described;
  if (isInvalid) next['aria-invalid'] = true;
  if (next['aria-describedby'] === undefined && next['aria-invalid'] === undefined) {
    return children;
  }
  return cloneElement(child, next);
}

function FormField({
  id,
  label,
  error,
  invalid = false,
  description,
  keepDescription = false,
  required,
  className,
  children,
}: FormFieldProps) {
  const showDescription = Boolean(description) && (keepDescription || !error);
  const descriptionId = showDescription ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = joinDescribedBy(descriptionId, errorId);
  const isInvalid = invalid || Boolean(error);
  const control =
    Children.count(children) === 1 ? enhanceControl(children, describedBy, isInvalid) : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      <FormLabel htmlFor={id} required={required}>
        {label}
      </FormLabel>
      {control}
      {showDescription ? (
        typeof description === 'string' ? (
          <p id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </p>
        ) : (
          <div id={descriptionId}>{description}</div>
        )
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

FormField.displayName = 'FormField';

export { FormField };
