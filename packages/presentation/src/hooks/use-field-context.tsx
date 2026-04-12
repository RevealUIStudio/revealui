import { createContext, type ReactNode, use, useId, useMemo } from 'react';

interface FieldContextValue {
  /** ID for the form control element */
  controlId: string;
  /** ID for the label element */
  labelId: string;
  /** ID for the description element */
  descriptionId: string;
  /** ID for the error message element */
  errorId: string;
  /** Whether the field is disabled */
  disabled: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue | null {
  return use(FieldContext);
}

interface FieldProviderProps {
  children: ReactNode;
  disabled?: boolean;
}

export function FieldProvider({ children, disabled = false }: FieldProviderProps): ReactNode {
  const id = useId();

  const value = useMemo<FieldContextValue>(
    () => ({
      controlId: `${id}-control`,
      labelId: `${id}-label`,
      descriptionId: `${id}-description`,
      errorId: `${id}-error`,
      disabled,
    }),
    [id, disabled],
  );

  return <FieldContext value={value}>{children}</FieldContext>;
}

/**
 * Returns ARIA props for a form control that participates in a Field.
 * Safe to call outside a Field  -  returns empty object if no context.
 */
export function useFieldControlProps(): Record<string, string | undefined> {
  const ctx = useFieldContext();
  if (!ctx) return {};

  return {
    id: ctx.controlId,
    'aria-labelledby': ctx.labelId,
    'aria-describedby': ctx.descriptionId,
    'data-disabled': ctx.disabled ? '' : undefined,
  };
}

/**
 * Returns props for a label element within a Field.
 */
export function useFieldLabelProps(): Record<string, string | undefined> {
  const ctx = useFieldContext();
  if (!ctx) return {};

  return {
    id: ctx.labelId,
    htmlFor: ctx.controlId,
    'data-disabled': ctx.disabled ? '' : undefined,
  };
}

/**
 * Returns props for a description element within a Field.
 */
export function useFieldDescriptionProps(): Record<string, string | undefined> {
  const ctx = useFieldContext();
  if (!ctx) return {};

  return {
    id: ctx.descriptionId,
    'data-disabled': ctx.disabled ? '' : undefined,
  };
}

/**
 * Returns props for an error message element within a Field.
 */
export function useFieldErrorProps(): Record<string, string | undefined> {
  const ctx = useFieldContext();
  if (!ctx) return {};

  return {
    id: ctx.errorId,
    'data-disabled': ctx.disabled ? '' : undefined,
  };
}
