/**
 * RevealUI admin UI Components
 *
 * Provides form field components and utilities for the admin dashboard interface.
 */

'use client';

import { logger } from '@revealui/core/utils/logger';
import React from 'react';

// Form field types
export interface TextInputProps {
  path: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  disabled?: boolean;
}

export interface FieldLabelProps {
  htmlFor?: string;
  label: string;
  required?: boolean;
  className?: string;
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
  );
};

// Field label component
export const FieldLabel: React.FC<FieldLabelProps> = ({ htmlFor, label, required, className }) => {
  return (
    <label htmlFor={htmlFor} className={className}>
      {label}
      {required && <span className="required">*</span>}
    </label>
  );
};

// Form field hook types
export interface FormField {
  value: unknown;
  setValue: (value: unknown) => void;
  path: string;
}

export interface UseFormFieldsOptions {
  fields: string[];
}

// Hook for accessing form fields (RevealUI-compatible signature)
export function useFormFields<T = unknown>(
  selectorOrOptions: ((fields: [Record<string, FormField>, unknown]) => T) | UseFormFieldsOptions,
): T | Record<string, FormField> {
  const [fieldValues, setFieldValues] = React.useState<Record<string, unknown>>({});

  // If a selector function is provided
  if (typeof selectorOrOptions === 'function') {
    // Create a dispatch placeholder
    const dispatch = (action: unknown) => {
      logger.debug('Form dispatch', { action });
    };
    // Convert field values to FormField objects for the selector
    const formFields: Record<string, FormField> = {};
    Object.keys(fieldValues).forEach((fieldPath) => {
      formFields[fieldPath] = {
        value: fieldValues[fieldPath],
        setValue: (value: unknown) => {
          setFieldValues((prev) => ({
            ...prev,
            [fieldPath]: value,
          }));
        },
        path: fieldPath,
      };
    });
    return selectorOrOptions([formFields, dispatch]);
  }

  // Legacy options-based usage
  const result: Record<string, FormField> = {};

  for (const fieldPath of selectorOrOptions.fields) {
    result[fieldPath] = {
      value: fieldValues[fieldPath],
      setValue: (value: unknown) => {
        setFieldValues((prev) => ({
          ...prev,
          [fieldPath]: value,
        }));
      },
      path: fieldPath,
    };
  }

  return result;
}

// Hook for accessing a single field
export interface UseFieldOptions {
  path: string;
}

export function useField<T = unknown>(
  options: UseFieldOptions,
): {
  value: T | undefined;
  setValue: (value: T) => void;
  path: string;
} {
  const [value, setValueState] = React.useState<T | undefined>(undefined);

  const setValue = React.useCallback((newValue: T) => {
    setValueState(newValue);
  }, []);

  return {
    value,
    setValue,
    path: options.path,
  };
}

// Additional common UI components
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'ghost';
  buttonStyle?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  el?: string;
  icon?: string;
  round?: boolean;
  tooltip?: string;
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
  );
};

// Select input
export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectInputProps {
  path: string;
  value?: string;
  options: SelectOption[];
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
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
  );
};

// Textarea
export interface TextareaProps {
  path: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
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
  );
};

// Checkbox
export interface CheckboxProps {
  path: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
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
  );
};

// Modal context and hooks
interface ModalContextType {
  openModals: Set<string>;
  toggleModal: (slug: string) => void;
  closeModal: (slug: string) => void;
  isModalOpen: (slug: string) => boolean;
}

const ModalContext = React.createContext<ModalContextType>({
  openModals: new Set(),
  toggleModal: () => undefined,
  closeModal: () => undefined,
  isModalOpen: () => false,
});

export function useModal() {
  const context = React.use(ModalContext);
  return context;
}

export interface ModalProviderProps {
  children: React.ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [openModals, setOpenModals] = React.useState<Set<string>>(new Set());

  const toggleModal = React.useCallback((slug: string) => {
    setOpenModals((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

  const closeModal = React.useCallback((slug: string) => {
    setOpenModals((prev) => {
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });
  }, []);

  const isModalOpen = React.useCallback((slug: string) => openModals.has(slug), [openModals]);

  return (
    <ModalContext.Provider value={{ openModals, toggleModal, closeModal, isModalOpen }}>
      {children}
    </ModalContext.Provider>
  );
};

// Fields Drawer component for rich text editor
export interface FieldsDrawerProps {
  data: Record<string, unknown>;
  drawerSlug: string;
  drawerTitle: string;
  featureKey: string;
  schemaPath: string;
  schemaPathSuffix?: string;
  handleDrawerSubmit: (fields: unknown, data: Record<string, unknown>) => void;
}

export const FieldsDrawer: React.FC<FieldsDrawerProps> = ({
  data,
  drawerSlug,
  drawerTitle,
  handleDrawerSubmit,
}) => {
  const { isModalOpen, closeModal } = useModal();
  const [formData, setFormData] = React.useState<Record<string, unknown>>(data);

  React.useEffect(() => {
    setFormData(data);
  }, [data]);

  if (!isModalOpen(drawerSlug)) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleDrawerSubmit(null, formData);
  };

  return (
    <div className="fields-drawer-overlay">
      <div className="fields-drawer">
        <div className="fields-drawer-header">
          <h3>{drawerTitle}</h3>
          <button type="button" onClick={() => closeModal(drawerSlug)}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="fields-drawer-content">
            {/* Render fields based on schema - simplified for now */}
            <TextInput
              path="url"
              value={(formData.url as string) || ''}
              onChange={(value) => setFormData({ ...formData, url: value })}
              placeholder="Enter URL"
            />
          </div>
          <div className="fields-drawer-footer">
            <Button type="submit" variant="primary">
              Submit
            </Button>
            <Button type="button" variant="secondary" onClick={() => closeModal(drawerSlug)}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
