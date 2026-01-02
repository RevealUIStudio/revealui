/**
 * RevealUI CMS UI Components
 * 
 * Provides form field components and utilities for the CMS admin interface.
 */

'use client'

import React from 'react'

// Form field types
export interface TextInputProps {
  path: string
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  readOnly?: boolean
  disabled?: boolean
}

export interface FieldLabelProps {
  htmlFor?: string
  label: string
  required?: boolean
  className?: string
}

// Text input component
export const TextInput: React.FC<TextInputProps> = ({
  path,
  value = '',
  onChange,
  placeholder,
  className,
  readOnly,
  disabled,
}) => {
  return (
    <input
      type="text"
      name={path}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={className}
      readOnly={readOnly}
      disabled={disabled}
    />
  )
}

// Field label component
export const FieldLabel: React.FC<FieldLabelProps> = ({
  htmlFor,
  label,
  required,
  className,
}) => {
  return (
    <label htmlFor={htmlFor} className={className}>
      {label}
      {required && <span className="required">*</span>}
    </label>
  )
}

// Form field hook types
export interface FormField {
  value: unknown
  setValue: (value: unknown) => void
  path: string
}

export interface UseFormFieldsOptions {
  fields: string[]
}

// Hook for accessing form fields
export function useFormFields(options: UseFormFieldsOptions): Record<string, FormField> {
  const [fields, setFields] = React.useState<Record<string, unknown>>({})
  
  const result: Record<string, FormField> = {}
  
  for (const fieldPath of options.fields) {
    result[fieldPath] = {
      value: fields[fieldPath],
      setValue: (value: unknown) => {
        setFields((prev) => ({ ...prev, [fieldPath]: value }))
      },
      path: fieldPath,
    }
  }
  
  return result
}

// Additional common UI components
export interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled,
  className,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant} btn-${size} ${className || ''}`}
    >
      {children}
    </button>
  )
}

// Select input
export interface SelectOption {
  label: string
  value: string
}

export interface SelectInputProps {
  path: string
  value?: string
  options: SelectOption[]
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export const SelectInput: React.FC<SelectInputProps> = ({
  path,
  value = '',
  options,
  onChange,
  placeholder,
  className,
  disabled,
}) => {
  return (
    <select
      name={path}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={className}
      disabled={disabled}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

// Textarea
export interface TextareaProps {
  path: string
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  rows?: number
  disabled?: boolean
}

export const Textarea: React.FC<TextareaProps> = ({
  path,
  value = '',
  onChange,
  placeholder,
  className,
  rows = 3,
  disabled,
}) => {
  return (
    <textarea
      name={path}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={className}
      rows={rows}
      disabled={disabled}
    />
  )
}

// Checkbox
export interface CheckboxProps {
  path: string
  checked?: boolean
  onChange?: (checked: boolean) => void
  label?: string
  className?: string
  disabled?: boolean
}

export const Checkbox: React.FC<CheckboxProps> = ({
  path,
  checked = false,
  onChange,
  label,
  className,
  disabled,
}) => {
  return (
    <label className={className}>
      <input
        type="checkbox"
        name={path}
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
      />
      {label && <span>{label}</span>}
    </label>
  )
}
