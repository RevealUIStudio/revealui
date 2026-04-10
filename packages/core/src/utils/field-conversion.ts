/**
 * Field Conversion Utilities
 *
 * Converts between standard Field types and RevealUIField types.
 *
 * NOTE ON TYPE ASSERTIONS:
 * The type assertions in this file are necessary due to TypeScript's limitation
 * with narrowing separate variables. Here's why:
 *
 * 1. `baseField` is initialized as `RevealUIField` (a union type) or `Field` (a union type)
 * 2. TypeScript can narrow `field` or `revealUIField` in conditionals/switches
 * 3. However, TypeScript CANNOT narrow `baseField` because it's a separate variable
 *    that was explicitly typed, not derived from the narrowed value
 *
 * The assertions (`as RevealUITextField`, etc.) are used to tell TypeScript that
 * after type narrowing checks, we're assigning type-specific properties that exist
 * on the narrowed type but not on the base union type.
 *
 * Alternative approaches considered:
 * - Returning different object literals per type: Would work but duplicates code
 * - Using type predicates on baseField: Not possible without runtime checks
 * - Restructuring to avoid mutations: Would require significant refactoring
 *
 * These assertions are safe because they're guarded by runtime type checks
 * (isTextField, isArrayField, switch on field.type).
 */

import type { FieldValidateArgs } from '@revealui/contracts/admin';
import { isArrayField, isTextField } from '@revealui/contracts/admin';
import type {
  ArrayField,
  CheckboxField,
  Field,
  RevealUIField,
  RevealUIHookContext,
  TextField,
} from '../types/index.js';

// Type aliases for specific RevealUI field types
type RevealUITextField = RevealUIField & { type: 'text' };
type RevealUICheckboxField = RevealUIField & { type: 'checkbox' };
type RevealUIArrayField = RevealUIField & { type: 'array' };
type RevealUIRichTextField = RevealUIField & { type: 'richText' };
type RichTextField = Field & { type: 'richText' };

const getFieldLabel = (field: { label?: unknown; name?: unknown }): string => {
  if (typeof field.label === 'string' && field.label.length > 0) {
    return field.label;
  }
  if (typeof field.name === 'string' && field.name.length > 0) {
    return field.name;
  }
  return 'Field';
};

// Convert from standard field to RevealUI field
export function convertToRevealUIField(field: Field): RevealUIField {
  const labelText = getFieldLabel(field);
  const baseField: RevealUIField = {
    name: field.name || '',
    type: field.type,
    label: field.label,
    required: field.required,
    revealUI: {
      searchable: false,
      permissions: ['read', 'write'],
      tenantScoped: false,
      auditLog: false,
      validation: field.required
        ? [
            {
              type: 'required',
              message: `${labelText} is required`,
            },
          ]
        : [],
    },
    admin: field.admin,
    validate: field.validate
      ? (value: unknown, args: FieldValidateArgs) => {
          // Pass through the validation args directly
          // Field.validate expects (value, args) where args is FieldValidateArgs
          if (field.validate) {
            const result: unknown = field.validate(value, args);
            if (result === true || typeof result === 'string') {
              return result;
            }
            return true;
          }
          return true;
        }
      : undefined,
  };

  // Add type-specific properties using type guards and switch narrowing
  // NOTE: Type assertions are necessary here because TypeScript cannot narrow
  // `baseField` even though we've narrowed `field`. See file-level comment.
  if (isTextField(field)) {
    // TypeScript narrows field to TextField here, but baseField remains RevealUIField
    // Assertion is safe because we've verified field.type === 'text'
    const textBaseField = baseField as RevealUITextField;
    textBaseField.maxLength = field.maxLength;
    textBaseField.minLength = field.minLength;
  } else if (isArrayField(field)) {
    // TypeScript narrows field to ArrayField here, but baseField remains RevealUIField
    // Assertion is safe because we've verified field.type === 'array'
    const arrayBaseField = baseField as RevealUIArrayField;
    if (field.fields) {
      arrayBaseField.fields = field.fields.map((f) => convertToRevealUIField(f));
    }
    arrayBaseField.minRows = field.minRows;
    arrayBaseField.maxRows = field.maxRows;
  } else {
    // Use switch for types without type guards
    switch (field.type) {
      case 'checkbox': {
        // TypeScript narrows field in switch statement, but baseField needs assertion
        // Assertion on field is needed because CheckboxField might not be properly discriminated
        const checkboxBaseField = baseField as RevealUICheckboxField;
        checkboxBaseField.defaultValue = (field as CheckboxField).defaultValue;
        break;
      }
      case 'richText': {
        // TypeScript narrows field in switch statement, but baseField needs assertion
        // Assertion on field is needed because RichTextField might not be properly discriminated
        const richTextBaseField = baseField as RevealUIRichTextField;
        richTextBaseField.editor = (field as RichTextField).editor;
        break;
      }
    }
  }

  return baseField;
}

// Convert from RevealUI field to standard field
export function convertFromRevealUIField(revealUIField: RevealUIField): Field {
  const baseField: Field = {
    name: revealUIField.name || '',
    type: revealUIField.type,
    label: revealUIField.label,
    required: revealUIField.required,
    admin: revealUIField.admin,
    validate: revealUIField.validate
      ? (value: unknown, args: FieldValidateArgs) => {
          // Pass through the validation args directly
          // RevealUIField.validate should accept FieldValidateArgs
          if (revealUIField.validate) {
            const result: unknown = revealUIField.validate(value, args);
            if (result === true || typeof result === 'string') {
              return result;
            }
            return true;
          }
          return true;
        }
      : undefined,
  };

  // Add type-specific properties using type guards and switch narrowing
  // NOTE: Type assertions are necessary here because TypeScript cannot narrow
  // `baseField` even though we've narrowed `revealUIField`. See file-level comment.
  if (revealUIField.type === 'text') {
    // TypeScript narrows revealUIField to RevealUITextField, but baseField remains Field
    // Assertions are safe because we've verified revealUIField.type === 'text'
    const textBaseField = baseField as TextField;
    const textField = revealUIField as RevealUITextField;
    textBaseField.maxLength = textField.maxLength;
    textBaseField.minLength = textField.minLength;
  } else if (revealUIField.type === 'array') {
    // TypeScript narrows revealUIField to RevealUIArrayField, but baseField remains Field
    // Assertions are safe because we've verified revealUIField.type === 'array'
    const arrayBaseField = baseField as ArrayField;
    const arrayField = revealUIField as RevealUIArrayField;

    if (arrayField.fields) {
      // Convert RevealUIField[] to Field[] - this is safe because RevealUIField extends Field
      arrayBaseField.fields = arrayField.fields.map((f: RevealUIField) =>
        convertFromRevealUIField(f),
      ) as ArrayField['fields'];
    }

    arrayBaseField.minRows = arrayField.minRows;
    arrayBaseField.maxRows = arrayField.maxRows;
  } else {
    // Use switch for types without type guards
    switch (revealUIField.type) {
      case 'checkbox': {
        // TypeScript narrows revealUIField in switch statement, but baseField needs assertion
        // Assertion on revealUIField is needed because RevealUICheckboxField might not be properly discriminated
        const checkboxBaseField = baseField as CheckboxField;
        checkboxBaseField.defaultValue = (revealUIField as RevealUICheckboxField).defaultValue;
        break;
      }
      case 'richText': {
        // TypeScript narrows revealUIField in switch statement, but baseField needs assertion
        // Assertion on revealUIField is needed because RevealUIRichTextField might not be properly discriminated
        const richTextBaseField = baseField as RichTextField;
        richTextBaseField.editor = (revealUIField as RevealUIRichTextField).editor;
        break;
      }
    }
  }

  return baseField;
}

// Enhance a standard field with RevealUI features
export function enhanceFieldWithRevealUI(
  field: Field,
  revealUIOptions?: RevealUIField['revealUI'],
): RevealUIField {
  const revealUIField = convertToRevealUIField(field);

  if (revealUIOptions) {
    revealUIField.revealUI = {
      ...revealUIField.revealUI,
      ...revealUIOptions,
    };
  }

  return revealUIField;
}

// Validation context for RevealUI field validation
interface RevealUIValidationContext {
  data: Record<string, unknown>;
  siblingData: Record<string, unknown>;
  user?: import('@revealui/contracts').BaseRevealUser | null;
  operation: 'create' | 'update';
  tenant?: string;
}

// Validate a RevealUI field
export function validateRevealUIField(
  field: RevealUIField,
  value: unknown,
  context: RevealUIValidationContext,
): string | true {
  const labelText = getFieldLabel(field);
  // Run RevealUI-specific validations
  if (field.revealUI?.validation) {
    for (const rule of field.revealUI.validation) {
      // Convert context to RevealUIHookContext for rule validation
      const hookContext: RevealUIHookContext = {
        revealui: undefined,
        operation: context.operation,
        user: context.user,
        tenant: context.tenant || '',
      };

      switch (rule.type) {
        case 'required':
          if (!value) {
            return rule.message || `${labelText} is required`;
          }
          break;
        case 'min':
          {
            const minValue = typeof rule.value === 'number' ? rule.value : undefined;
            // For string values, check length
            if (typeof value === 'string' && minValue !== undefined && value.length < minValue) {
              return rule.message || `${labelText} must be at least ${minValue} characters`;
            }
            // For number values, check value
            if (typeof value === 'number' && minValue !== undefined && value < minValue) {
              return rule.message || `${labelText} must be at least ${minValue}`;
            }
          }
          break;
        case 'max':
          {
            const maxValue = typeof rule.value === 'number' ? rule.value : undefined;
            // For string values, check length
            if (typeof value === 'string' && maxValue !== undefined && value.length > maxValue) {
              return rule.message || `${labelText} must be no more than ${maxValue} characters`;
            }
            // For number values, check value
            if (typeof value === 'number' && maxValue !== undefined && value > maxValue) {
              return rule.message || `${labelText} must be no more than ${maxValue}`;
            }
          }
          break;
        case 'pattern':
          if (
            typeof value === 'string' &&
            rule.value instanceof RegExp &&
            !rule.value.test(value)
          ) {
            return rule.message || `${labelText} format is invalid`;
          }
          break;
        case 'custom':
          if (rule.validate) {
            const result = rule.validate(value, hookContext);
            if (result !== true) {
              return typeof result === 'string' ? result : `${labelText} is invalid`;
            }
          }
          break;
      }
    }
  }

  // Run the original field validator if it exists
  if (field.validate) {
    // Convert context to FieldValidateArgs format
    const validateArgs: FieldValidateArgs = {
      value,
      data: context.data,
      siblingData: context.siblingData,
      req: {
        user: context.user,
      },
      operation: context.operation,
    };
    const result: unknown = field.validate(value, validateArgs);
    if (result !== true) {
      return typeof result === 'string' ? result : `${labelText} is invalid`;
    }
  }

  return true;
}
