/**
 * Shared types for form field components
 */

import type { Control, FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';

/**
 * Base props for all form field components
 */
export interface BaseFormFieldProps {
  name: string;
  label?: string;
  required?: boolean;
  width?: string | number;
  errors: FieldErrors<FieldValues>;
  register: UseFormRegister<FieldValues>;
}

/**
 * Props for form fields that use Controller (Select, Country, State, etc.)
 */
export interface ControlledFormFieldProps {
  name: string;
  label?: string;
  required?: boolean;
  width?: string | number;
  errors: FieldErrors<FieldValues>;
  control: Control<FieldValues>;
}
