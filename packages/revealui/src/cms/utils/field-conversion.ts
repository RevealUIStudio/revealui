import type { Field, TextField, CheckboxField, ArrayField, RichTextField } from '../types/index';
import type {
  RevealUIField,
  RevealUITextField,
  RevealUICheckboxField,
  RevealUIArrayField,
  RevealUIRichTextField,
  RevealUIValidationContext,
  RevealUIValidationRule
} from '../types/index';

// Convert from Payload field to RevealUI field
export function convertToRevealUIField(field: Field): RevealUIField {
  const baseField: RevealUIField = {
    name: field.name,
    type: field.type as any, // Type assertion - we trust the input
    label: field.label,
    required: field.required,
    revealUI: {
      searchable: false,
      permissions: ['read', 'write'],
      tenantScoped: false,
      auditLog: false,
      validation: []
    },
    admin: field.admin,
    validate: field.validate ? (value: unknown, context: RevealUIValidationContext) => {
      // Convert Payload validation context to RevealUI context
      const payloadContext = {
        data: context.data,
        siblingData: context.siblingData,
        user: context.user as any, // Type assertion
        operation: context.operation
      };
      return field.validate!(value, payloadContext);
    } : undefined
  };

  // Add type-specific properties
  switch (field.type) {
    case 'text':
      const textField = field as TextField;
      (baseField as RevealUITextField).maxLength = textField.maxLength;
      (baseField as RevealUITextField).minLength = textField.minLength;
      break;
    case 'checkbox':
      const checkboxField = field as CheckboxField;
      (baseField as RevealUICheckboxField).defaultValue = checkboxField.defaultValue;
      break;
    case 'array':
      const arrayField = field as ArrayField;
      (baseField as RevealUIArrayField).fields = arrayField.fields.map(convertToRevealUIField);
      (baseField as RevealUIArrayField).minRows = arrayField.minRows;
      (baseField as RevealUIArrayField).maxRows = arrayField.maxRows;
      break;
    case 'richText':
      const richTextField = field as RichTextField;
      (baseField as RevealUIRichTextField).editor = richTextField.editor as any;
      break;
  }

  return baseField;
}

// Convert from RevealUI field to Payload field
export function convertFromRevealUIField(revealUIField: RevealUIField): Field {
  const baseField: Field = {
    name: revealUIField.name,
    type: revealUIField.type as any,
    label: revealUIField.label,
    required: revealUIField.required,
    admin: revealUIField.admin,
    validate: revealUIField.validate ? (value: unknown, options: any) => {
      // Convert Payload context to RevealUI context
      const revealUIContext: RevealUIValidationContext = {
        data: options.data,
        siblingData: options.siblingData,
        user: options.user,
        operation: options.operation
      };
      return revealUIField.validate!(value, revealUIContext);
    } : undefined
  };

  // Add type-specific properties
  switch (revealUIField.type) {
    case 'text':
      const textField = revealUIField as RevealUITextField;
      (baseField as TextField).maxLength = textField.maxLength;
      (baseField as TextField).minLength = textField.minLength;
      break;
    case 'checkbox':
      const checkboxField = revealUIField as RevealUICheckboxField;
      (baseField as CheckboxField).defaultValue = checkboxField.defaultValue;
      break;
    case 'array':
      const arrayField = revealUIField as RevealUIArrayField;
      (baseField as ArrayField).fields = arrayField.fields.map(convertFromRevealUIField);
      (baseField as ArrayField).minRows = arrayField.minRows;
      (baseField as ArrayField).maxRows = arrayField.maxRows;
      break;
    case 'richText':
      const richTextField = revealUIField as RevealUIRichTextField;
      (baseField as RichTextField).editor = richTextField.editor as any;
      break;
  }

  return baseField;
}

// Enhance a Payload field with RevealUI features
export function enhanceFieldWithRevealUI(field: Field, revealUIOptions?: RevealUIField['revealUI']): RevealUIField {
  const revealUIField = convertToRevealUIField(field);

  if (revealUIOptions) {
    revealUIField.revealUI = {
      ...revealUIField.revealUI,
      ...revealUIOptions
    };
  }

  return revealUIField;
}

// Validate a RevealUI field
export function validateRevealUIField(field: RevealUIField, value: unknown, context: RevealUIValidationContext): string | true {
  // Run RevealUI-specific validations
  if (field.revealUI?.validation) {
    for (const rule of field.revealUI.validation) {
      if (rule.condition && !rule.condition(context)) {
        continue; // Skip this rule if condition not met
      }

      switch (rule.type) {
        case 'required':
          if (!value) {
            return rule.message || `${field.label || field.name} is required`;
          }
          break;
        case 'minLength':
          if (typeof value === 'string' && value.length < (rule.value as number)) {
            return rule.message || `${field.label || field.name} must be at least ${rule.value} characters`;
          }
          break;
        case 'maxLength':
          if (typeof value === 'string' && value.length > (rule.value as number)) {
            return rule.message || `${field.label || field.name} must be no more than ${rule.value} characters`;
          }
          break;
        case 'pattern':
          if (typeof value === 'string' && !(rule.value as RegExp).test(value)) {
            return rule.message || `${field.label || field.name} format is invalid`;
          }
          break;
        case 'custom':
          if (typeof rule.value === 'function') {
            const result = rule.value(value, context);
            if (result !== true) {
              return result;
            }
          }
          break;
      }
    }
  }

  // Run the original field validator if it exists
  if (field.validate) {
    return field.validate(value, context);
  }

  return true;
}
