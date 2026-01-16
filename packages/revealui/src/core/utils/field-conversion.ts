import type { FieldValidateArgs } from '@revealui/schema/core'
import type {
  ArrayField,
  CheckboxField,
  Field,
  RevealUIField,
  RevealUIHookContext,
  TextField,
} from '../types/index.js'

// Type aliases for specific RevealUI field types
type RevealUITextField = RevealUIField & { type: 'text' }
type RevealUICheckboxField = RevealUIField & { type: 'checkbox' }
type RevealUIArrayField = RevealUIField & { type: 'array' }
type RevealUIRichTextField = RevealUIField & { type: 'richText' }
type RichTextField = Field & { type: 'richText' }

// Convert from standard field to RevealUI field
export function convertToRevealUIField(field: Field): RevealUIField {
  const baseField: RevealUIField = {
    name: field.name,
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
              message: `${field.label || field.name} is required`,
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
            return field.validate(value, args)
          }
          return true
        }
      : undefined,
  }

  // Add type-specific properties
  switch (field.type) {
    case 'text': {
      const textField = field as TextField
      ;(baseField as RevealUITextField).maxLength = textField.maxLength
      ;(baseField as RevealUITextField).minLength = textField.minLength
      break
    }
    case 'checkbox': {
      const checkboxField = field as CheckboxField
      ;(baseField as RevealUICheckboxField).defaultValue = checkboxField.defaultValue
      break
    }
    case 'array': {
      const arrayField = field as ArrayField
      if (arrayField.fields) {
        // Type assertion needed due to Field type incompatibility between schema packages
        ;(baseField as RevealUIArrayField).fields = arrayField.fields.map((f) =>
          convertToRevealUIField(f as Field),
        ) as RevealUIField[]
      }
      ;(baseField as RevealUIArrayField).minRows = arrayField.minRows
      ;(baseField as RevealUIArrayField).maxRows = arrayField.maxRows
      break
    }
    case 'richText': {
      const richTextField = field as RichTextField
      ;(baseField as RevealUIRichTextField).editor = richTextField.editor
      break
    }
  }

  return baseField
}

// Convert from RevealUI field to standard field
export function convertFromRevealUIField(revealUIField: RevealUIField): Field {
  const baseField: Field = {
    name: revealUIField.name,
    type: revealUIField.type,
    label: revealUIField.label,
    required: revealUIField.required,
    admin: revealUIField.admin,
    validate: revealUIField.validate
      ? (value: unknown, args: FieldValidateArgs) => {
          // Pass through the validation args directly
          // RevealUIField.validate should accept FieldValidateArgs
          if (revealUIField.validate) {
            return revealUIField.validate(value, args)
          }
          return true
        }
      : undefined,
  }

  // Add type-specific properties
  switch (revealUIField.type) {
    case 'text': {
      const textField = revealUIField as RevealUITextField
      ;(baseField as TextField).maxLength = textField.maxLength
      ;(baseField as TextField).minLength = textField.minLength
      break
    }
    case 'checkbox': {
      const checkboxField = revealUIField as RevealUICheckboxField
      ;(baseField as CheckboxField).defaultValue = checkboxField.defaultValue
      break
    }
    case 'array': {
      const arrayField = revealUIField as RevealUIArrayField
      const arrayBaseField = baseField as ArrayField

      if (arrayField.fields) {
        // Type assertion needed due to Field type incompatibility between schema packages
        // The fields are structurally compatible but come from different type definitions
        // contracts/config.Field has admin.position?: string, while field.Field has admin.position?: "sidebar"
        // Use double assertion to bridge the type gap since they're structurally compatible at runtime
        const convertedFields = arrayField.fields.map((f) =>
          convertFromRevealUIField(f),
        ) as unknown as Field[]
        arrayBaseField.fields = convertedFields as unknown as ArrayField['fields']
      }

      arrayBaseField.minRows = arrayField.minRows
      arrayBaseField.maxRows = arrayField.maxRows
      break
    }
    case 'richText': {
      const richTextField = revealUIField as RevealUIRichTextField
      ;(baseField as RichTextField).editor = richTextField.editor
      break
    }
  }

  return baseField
}

// Enhance a standard field with RevealUI features
export function enhanceFieldWithRevealUI(
  field: Field,
  revealUIOptions?: RevealUIField['revealUI'],
): RevealUIField {
  const revealUIField = convertToRevealUIField(field)

  if (revealUIOptions) {
    revealUIField.revealUI = {
      ...revealUIField.revealUI,
      ...revealUIOptions,
    }
  }

  return revealUIField
}

// Validation context for RevealUI field validation
interface RevealUIValidationContext {
  data: Record<string, unknown>
  siblingData: Record<string, unknown>
  user?: unknown
  operation: 'create' | 'update'
  tenant?: string
}

// Validate a RevealUI field
export function validateRevealUIField(
  field: RevealUIField,
  value: unknown,
  context: RevealUIValidationContext,
): string | true {
  // Run RevealUI-specific validations
  if (field.revealUI?.validation) {
    for (const rule of field.revealUI.validation) {
      // Convert context to RevealUIHookContext for rule validation
      const hookContext: RevealUIHookContext = {
        revealui: undefined,
        operation: context.operation,
        user: context.user,
        tenant: context.tenant,
      }

      switch (rule.type) {
        case 'required':
          if (!value) {
            return rule.message || `${field.label || field.name} is required`
          }
          break
        case 'min':
          // For string values, check length
          if (typeof value === 'string' && value.length < (rule.value as number)) {
            return (
              rule.message ||
              `${field.label || field.name} must be at least ${rule.value} characters`
            )
          }
          // For number values, check value
          if (typeof value === 'number' && value < (rule.value as number)) {
            return rule.message || `${field.label || field.name} must be at least ${rule.value}`
          }
          break
        case 'max':
          // For string values, check length
          if (typeof value === 'string' && value.length > (rule.value as number)) {
            return (
              rule.message ||
              `${field.label || field.name} must be no more than ${rule.value} characters`
            )
          }
          // For number values, check value
          if (typeof value === 'number' && value > (rule.value as number)) {
            return rule.message || `${field.label || field.name} must be no more than ${rule.value}`
          }
          break
        case 'pattern':
          if (
            typeof value === 'string' &&
            rule.value instanceof RegExp &&
            !rule.value.test(value)
          ) {
            return rule.message || `${field.label || field.name} format is invalid`
          }
          break
        case 'custom':
          if (rule.validate) {
            const result = rule.validate(value, hookContext)
            if (result !== true) {
              return typeof result === 'string' ? result : `${field.label || field.name} is invalid`
            }
          }
          break
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
    }
    const result = field.validate(value, validateArgs)
    if (result !== true) {
      return typeof result === 'string' ? result : `${field.label || field.name} is invalid`
    }
  }

  return true
}
