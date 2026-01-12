/**
 * CMS Field Contracts
 *
 * Schema definitions for CMS field configurations.
 * These schemas define the contract for field definitions used
 * in collections and globals.
 */

import { z } from 'zod'

// =============================================================================
// Schema Version
// =============================================================================

export const FIELD_SCHEMA_VERSION = 1

// =============================================================================
// Field Types
// =============================================================================

export const FieldTypeSchema = z.enum([
  // Basic types
  'text',
  'textarea',
  'number',
  'email',
  'password',
  'code',
  'json',
  'date',
  'checkbox',
  'radio',
  'select',
  'point',
  // Relationship types
  'relationship',
  'upload',
  // Complex types
  'array',
  'blocks',
  'group',
  'richText',
  // Layout types (no name required)
  'row',
  'tabs',
  'collapsible',
  // UI-only types
  'ui',
])

export type FieldType = z.infer<typeof FieldTypeSchema>

// =============================================================================
// Field Admin Config
// =============================================================================

export const FieldAdminConfigSchema = z
  .object({
    /** Position in the form (main area or sidebar) */
    position: z.enum(['sidebar']).optional(),

    /** Read-only field */
    readOnly: z.boolean().optional(),

    /** Hidden in admin UI */
    hidden: z.boolean().optional(),

    /** Disabled (visible but not editable) */
    disabled: z.boolean().optional(),

    /** Hide the gutter/margin */
    hideGutter: z.boolean().optional(),

    /** Layout direction */
    layout: z.enum(['horizontal', 'vertical']).optional(),

    /** Description text */
    description: z.string().optional(),

    /** Field width (CSS value or number) */
    width: z.union([z.string(), z.number()]).optional(),

    /** Custom CSS styles */
    style: z.record(z.string(), z.unknown()).optional(),

    /** Custom CSS class */
    className: z.string().optional(),

    /** Placeholder text */
    placeholder: z.string().optional(),

    /** Autocomplete hint */
    autoComplete: z.string().optional(),

    /** Number of rows (for textarea) */
    rows: z.number().int().positive().optional(),

    /** Allow clearing the value */
    isClearable: z.boolean().optional(),

    /** Allow sorting (for arrays) */
    isSortable: z.boolean().optional(),

    /** Start collapsed (for collapsible) */
    initCollapsed: z.boolean().optional(),

    // Number field specific
    /** Step value for number inputs */
    step: z.number().optional(),

    // Date field specific
    /** Date picker configuration */
    date: z
      .object({
        displayFormat: z.string().optional(),
        minDate: z.date().optional(),
        maxDate: z.date().optional(),
        pickerAppearance: z.enum(['dayOnly', 'dayAndTime', 'timeOnly', 'monthOnly']).optional(),
      })
      .optional(),

    // Upload field specific
    /** Enable cropping */
    crop: z.boolean().optional(),

    /** Enable focal point selection */
    focalPoint: z.boolean().optional(),

    // Custom components (typed as unknown for flexibility)
    /** Custom component overrides */
    components: z
      .object({
        Field: z.unknown().optional(),
        Cell: z.unknown().optional(),
        Description: z.unknown().optional(),
        Label: z.unknown().optional(),
      })
      .optional(),
  })
  .passthrough() // Allow additional properties for extensibility

export type FieldAdminConfig = z.infer<typeof FieldAdminConfigSchema>

// =============================================================================
// Field Access Config
// =============================================================================

// Access functions are typed as unknown because they're runtime functions
// The actual function signatures are enforced at the CMS runtime level
export const FieldAccessConfigSchema = z
  .object({
    create: z.unknown().optional(),
    read: z.unknown().optional(),
    update: z.unknown().optional(),
  })
  .optional()

export type FieldAccessConfig = z.infer<typeof FieldAccessConfigSchema>

// =============================================================================
// Field Hooks Config
// =============================================================================

// Hooks are typed as unknown arrays because they're runtime functions
export const FieldHooksConfigSchema = z
  .object({
    beforeChange: z.array(z.unknown()).optional(),
    afterChange: z.array(z.unknown()).optional(),
    beforeValidate: z.array(z.unknown()).optional(),
    afterRead: z.array(z.unknown()).optional(),
  })
  .optional()

export type FieldHooksConfig = z.infer<typeof FieldHooksConfigSchema>

// =============================================================================
// Select/Radio Option
// =============================================================================

export const FieldOptionSchema = z.union([
  z.string(),
  z.object({
    label: z.string(),
    value: z.string(),
  }),
])

export type FieldOption = z.infer<typeof FieldOptionSchema>

// =============================================================================
// Tab Definition (for tabs field)
// =============================================================================

// =============================================================================
// Field Type Definition (for recursive types)
// =============================================================================

/**
 * Field type - manually defined to break circular reference
 * This matches the shape of FieldSchema but is defined as an interface
 */
export interface Field {
  schemaVersion?: number
  name?: string
  type: FieldType
  label?: string | false | unknown // Function type handled at runtime
  labels?: { singular?: string; plural?: string }
  required?: boolean
  unique?: boolean
  defaultValue?: unknown
  validate?: unknown // Validation function - typed at runtime
  admin?: FieldAdminConfig
  hooks?: FieldHooksConfig
  access?: FieldAccessConfig
  localized?: boolean
  index?: boolean
  relationTo?: string | string[]
  hasMany?: boolean
  filterOptions?: unknown
  maxDepth?: number
  depth?: number
  editor?: unknown
  fields?: Field[]
  blocks?: unknown[]
  tabs?: TabDefinition[]
  rows?: Field[][]
  options?: FieldOption[]
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  minRows?: number
  maxRows?: number
  width?: number | string
  /** Custom properties for extensibility (without breaking type inference) */
  custom?: Record<string, unknown>
}

/**
 * Tab definition for tabs field
 */
export interface TabDefinition {
  label?: string
  name?: string
  fields: Field[]
  description?: string
}

// Create schema with type assertion to break circular inference
export const TabDefinitionSchema = z.lazy(() =>
  z.object({
    label: z.string().optional(),
    name: z.string().optional(),
    fields: z.array(FieldSchema),
    description: z.string().optional(),
  }),
) as z.ZodType<TabDefinition>

// =============================================================================
// Base Field Schema
// =============================================================================

/**
 * Non-recursive parts of field schema
 */
const BaseFieldPropertiesSchema = z
  .object({
    /** Schema version */
    schemaVersion: z.number().int().default(FIELD_SCHEMA_VERSION).optional(),

    /** Field name (optional for layout fields) */
    name: z.string().optional(),

    /** Field type */
    type: FieldTypeSchema,

    /** Display label - can be string, false, or a function */
    label: z
      .union([
        z.string(),
        z.literal(false),
        z.unknown(), // Label function - typed as unknown in schema, precise type in interface
      ])
      .optional(),

    /** Singular/plural labels */
    labels: z
      .object({
        singular: z.string().optional(),
        plural: z.string().optional(),
      })
      .optional(),

    /** Required field */
    required: z.boolean().optional(),

    /** Unique value constraint */
    unique: z.boolean().optional(),

    /** Default value */
    defaultValue: z.unknown().optional(),

    /** Validation function */
    validate: z.unknown().optional(),

    /** Admin UI configuration */
    admin: FieldAdminConfigSchema.optional(),

    /** Field-level hooks */
    hooks: FieldHooksConfigSchema,

    /** Field-level access control */
    access: FieldAccessConfigSchema,

    /** Localized field */
    localized: z.boolean().optional(),

    /** Database index */
    index: z.boolean().optional(),

    // Relationship fields
    /** Related collection(s) */
    relationTo: z.union([z.string(), z.array(z.string())]).optional(),

    /** Allow multiple values */
    hasMany: z.boolean().optional(),

    /** Filter options for relationships */
    filterOptions: z.unknown().optional(),

    /** Maximum population depth */
    maxDepth: z.number().int().optional(),

    /** Population depth */
    depth: z.number().int().optional(),

    // Rich text
    /** Rich text editor configuration */
    editor: z.unknown().optional(),

    /** Block definitions */
    blocks: z.array(z.unknown()).optional(),

    // Select/radio options
    /** Options for select/radio fields */
    options: z.array(FieldOptionSchema).optional(),

    // Number constraints
    /** Minimum value */
    min: z.number().optional(),

    /** Maximum value */
    max: z.number().optional(),

    // Text constraints
    /** Minimum length */
    minLength: z.number().int().optional(),

    /** Maximum length */
    maxLength: z.number().int().optional(),

    /** Minimum rows (for arrays) */
    minRows: z.number().int().optional(),

    /** Maximum rows (for arrays) */
    maxRows: z.number().int().optional(),

    /** Field width */
    width: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough() // Allow additional properties for extensibility

/**
 * Full field schema with recursive properties
 * The schema validates runtime data; the Field interface provides precise types
 */
export const FieldSchema: z.ZodType<Field> = z.lazy(() =>
  BaseFieldPropertiesSchema.extend({
    // Recursive fields
    fields: z.array(FieldSchema).optional(),
    tabs: z.array(TabDefinitionSchema).optional(),
    rows: z.array(z.array(FieldSchema)).optional(),
  }),
) as z.ZodType<Field>

// =============================================================================
// Specific Field Type Schemas
// =============================================================================

// For specific field types, we use the base properties schema which is not lazy
// This allows us to use .extend() for stricter type checking

export const TextFieldSchema = BaseFieldPropertiesSchema.extend({
  type: z.literal('text'),
  name: z.string(), // Required for text fields
})

export const NumberFieldSchema = BaseFieldPropertiesSchema.extend({
  type: z.literal('number'),
  name: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
})

export const RelationshipFieldSchema = BaseFieldPropertiesSchema.extend({
  type: z.literal('relationship'),
  name: z.string(),
  relationTo: z.union([z.string(), z.array(z.string())]),
})

export const ArrayFieldSchema = z.lazy(() =>
  BaseFieldPropertiesSchema.extend({
    type: z.literal('array'),
    name: z.string(),
    fields: z.array(FieldSchema),
  }),
) as z.ZodType<ArrayField>

export const GroupFieldSchema = z.lazy(() =>
  BaseFieldPropertiesSchema.extend({
    type: z.literal('group'),
    name: z.string(),
    fields: z.array(FieldSchema),
  }),
) as z.ZodType<GroupField>

export const SelectFieldSchema = BaseFieldPropertiesSchema.extend({
  type: z.literal('select'),
  name: z.string(),
  options: z.array(FieldOptionSchema),
})

// Layout fields (no name required)
export const RowFieldSchema = z.lazy(() =>
  BaseFieldPropertiesSchema.extend({
    type: z.literal('row'),
    fields: z.array(FieldSchema),
  }),
) as z.ZodType<RowField>

export const TabsFieldSchema = z.lazy(() =>
  BaseFieldPropertiesSchema.extend({
    type: z.literal('tabs'),
    tabs: z.array(TabDefinitionSchema),
  }),
) as z.ZodType<TabsField>

// Specific field types - manually defined to avoid inference issues with lazy schemas
export type TextField = Field & { type: 'text'; name: string }
export type NumberField = Field & { type: 'number'; name: string; min?: number; max?: number }
export type RelationshipField = Field & {
  type: 'relationship'
  name: string
  relationTo: string | string[]
}
export type ArrayField = Field & { type: 'array'; name: string; fields: Field[] }
export type GroupField = Field & { type: 'group'; name: string; fields: Field[] }
export type SelectField = Field & { type: 'select'; name: string; options: FieldOption[] }
export type RowField = Field & { type: 'row'; fields: Field[] }
export type TabsField = Field & { type: 'tabs'; tabs: TabDefinition[] }

// =============================================================================
// Type Guards
// =============================================================================

export function isTextField(field: Field): field is TextField {
  return field.type === 'text'
}

export function isNumberField(field: Field): field is NumberField {
  return field.type === 'number'
}

export function isRelationshipField(field: Field): field is RelationshipField {
  return field.type === 'relationship'
}

export function isArrayField(field: Field): field is ArrayField {
  return field.type === 'array'
}

export function isGroupField(field: Field): field is GroupField {
  return field.type === 'group'
}

export function isLayoutField(field: Field): boolean {
  return ['row', 'tabs', 'collapsible'].includes(field.type)
}

export function hasNestedFields(field: Field): boolean {
  return (
    ['array', 'group', 'row', 'collapsible'].includes(field.type) ||
    (field.type === 'tabs' && !!field.tabs)
  )
}
