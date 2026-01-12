/**
 * Structure Schemas (Zod)
 *
 * These schemas validate the STRUCTURE of CMS configurations.
 *
 * IMPORTANT: These schemas do NOT validate function types (hooks, access, validate).
 * Function types are handled by TypeScript contracts in functions.ts.
 *
 * Why this split?
 * 1. Zod's z.function() only validates callability, not signatures
 * 2. Generic type parameters (e.g., <T>) cannot be represented in Zod
 * 3. Complex return types with conditional types don't work in Zod
 *
 * @module @revealui/schema/core/contracts/structure
 */

import { z } from 'zod'

// ============================================
// FIELD STRUCTURE SCHEMAS
// ============================================

/**
 * Valid field types in RevealUI CMS
 */
export const FieldTypeSchema = z.enum([
  // Basic fields
  'text',
  'textarea',
  'number',
  'email',
  'password',
  'code',
  'date',
  'checkbox',

  // Selection fields
  'select',
  'radio',

  // Relationship fields
  'relationship',
  'upload',

  // Structural fields
  'array',
  'blocks',
  'group',
  'row',
  'collapsible',
  'tabs',

  // Special fields
  'richText',
  'json',
  'point',
  'ui',
])

export type FieldType = z.infer<typeof FieldTypeSchema>

/**
 * Field admin configuration (UI-related settings)
 *
 * Note: This uses passthrough() to allow custom properties
 * that plugins might add.
 */
export const FieldAdminConfigSchema = z
  .object({
    // Position and layout
    position: z.string().optional(),
    width: z.union([z.string(), z.number()]).optional(),

    // State
    disabled: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    hidden: z.boolean().optional(),
    initCollapsed: z.boolean().optional(),

    // Help text
    description: z.string().optional(),
    placeholder: z.string().optional(),

    // Layout
    layout: z.enum(['horizontal', 'vertical']).optional(),

    // Styling
    style: z.record(z.string(), z.string()).optional(),
    className: z.string().optional(),

    // Note: 'components', 'condition' are functions - not validated here
  })
  .passthrough()
  .optional()

export type FieldAdminConfig = z.infer<typeof FieldAdminConfigSchema>

/**
 * Option for select/radio fields
 */
export const FieldOptionSchema = z.union([
  z.string(),
  z.object({
    label: z.string(),
    value: z.string(),
  }),
])

export type FieldOption = z.infer<typeof FieldOptionSchema>

/**
 * Block definition within a blocks field
 */
export const BlockDefinitionSchema = z
  .object({
    slug: z.string().min(1),
    labels: z
      .object({
        singular: z.string(),
        plural: z.string().optional(),
      })
      .optional(),
    imageURL: z.string().optional(),
    imageAltText: z.string().optional(),
    // Fields are recursive - handled in FieldStructureSchema
    fields: z.array(z.lazy(() => FieldStructureSchema)),
  })
  .passthrough()

export type BlockDefinition = z.infer<typeof BlockDefinitionSchema>

/**
 * Tab definition within a tabs field
 */
export const TabDefinitionSchema = z
  .object({
    label: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    // Fields are recursive
    fields: z.array(z.lazy(() => FieldStructureSchema)),
  })
  .passthrough()

export type TabDefinition = z.infer<typeof TabDefinitionSchema>

/**
 * Base field structure (common to all field types)
 *
 * This validates the structural properties of fields.
 * Function properties (access, hooks, validate) are typed separately.
 */
export const FieldStructureSchema: z.ZodType<FieldStructure> = z
  .object({
    // Type (required)
    type: FieldTypeSchema,

    // Identity
    name: z.string().min(1).optional(),

    // Labels
    label: z
      .union([
        z.string(),
        z.literal(false),
        // Note: Function labels are allowed but not validated by Zod
        z.unknown(),
      ])
      .optional(),

    // Constraints
    required: z.boolean().optional(),
    unique: z.boolean().optional(),
    index: z.boolean().optional(),
    localized: z.boolean().optional(),
    hidden: z.boolean().optional(),
    saveToJWT: z.union([z.boolean(), z.string()]).optional(),

    // Text field specific
    minLength: z.number().optional(),
    maxLength: z.number().optional(),

    // Number field specific
    min: z.number().optional(),
    max: z.number().optional(),

    // Relationship specific
    relationTo: z.union([z.string(), z.array(z.string())]).optional(),
    hasMany: z.boolean().optional(),
    maxDepth: z.number().optional(),

    // Select/Radio specific
    options: z.array(FieldOptionSchema).optional(),

    // Default value (any type)
    defaultValue: z.unknown().optional(),

    // Admin config
    admin: FieldAdminConfigSchema,

    // Nested fields (for array, group, row, collapsible)
    fields: z.array(z.lazy(() => FieldStructureSchema)).optional(),

    // Blocks (for blocks field)
    blocks: z.array(z.lazy(() => BlockDefinitionSchema)).optional(),

    // Tabs (for tabs field)
    tabs: z.array(z.lazy(() => TabDefinitionSchema)).optional(),

    // TypeScript interface name (for code generation)
    interfaceName: z.string().optional(),

    // Note: access, hooks, validate, condition, filterOptions, editor
    // are functions and are NOT validated by this schema.
    // They are typed in the Field interface which extends this.
  })
  .passthrough()

/**
 * Field structure type (without function properties)
 */
export interface FieldStructure {
  type: FieldType
  name?: string
  label?: string | false | unknown
  labels?: {
    singular?: string
    plural?: string
  }
  required?: boolean
  unique?: boolean
  index?: boolean
  localized?: boolean
  hidden?: boolean
  saveToJWT?: boolean | string
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  minRows?: number
  maxRows?: number
  relationTo?: string | string[]
  hasMany?: boolean
  maxDepth?: number
  options?: FieldOption[]
  defaultValue?: unknown
  admin?: FieldAdminConfig
  fields?: FieldStructure[]
  blocks?: BlockDefinition[]
  tabs?: TabDefinition[]
  interfaceName?: string
  custom?: Record<string, unknown>
}

// ============================================
// COLLECTION STRUCTURE SCHEMAS
// ============================================

/**
 * Collection labels configuration
 */
export const CollectionLabelsSchema = z
  .object({
    singular: z.string(),
    plural: z.string().optional(),
  })
  .optional()

export type CollectionLabels = z.infer<typeof CollectionLabelsSchema>

/**
 * Collection admin configuration
 */
export const CollectionAdminConfigSchema = z
  .object({
    useAsTitle: z.string().optional(),
    defaultColumns: z.array(z.string()).optional(),
    group: z.string().optional(),
    hidden: z.boolean().optional(),
    description: z.string().optional(),
    preview: z.unknown().optional(), // Function - not validated
    livePreview: z
      .object({
        url: z.unknown().optional(), // Function
        breakpoints: z
          .array(
            z.object({
              name: z.string(),
              width: z.number(),
              height: z.number(),
            }),
          )
          .optional(),
      })
      .optional(),
    pagination: z
      .object({
        defaultLimit: z.number().optional(),
        limits: z.array(z.number()).optional(),
      })
      .optional(),
    listSearchableFields: z.array(z.string()).optional(),
    enableRichTextLink: z.boolean().optional(),
    enableRichTextRelationship: z.boolean().optional(),
  })
  .passthrough()
  .optional()

export type CollectionAdminConfig = z.infer<typeof CollectionAdminConfigSchema>

/**
 * Version/draft configuration
 */
export const VersionConfigSchema = z
  .union([
    z.boolean(),
    z.object({
      drafts: z
        .union([
          z.boolean(),
          z.object({
            autosave: z
              .union([
                z.boolean(),
                z.object({
                  interval: z.number().optional(),
                }),
              ])
              .optional(),
            validate: z.boolean().optional(),
          }),
        ])
        .optional(),
      maxPerDoc: z.number().optional(),
    }),
  ])
  .optional()

export type VersionConfig = z.infer<typeof VersionConfigSchema>

/**
 * Upload configuration
 */
export const UploadConfigSchema = z
  .union([
    z.boolean(),
    z.object({
      staticURL: z.string().optional(),
      staticDir: z.string().optional(),
      mimeTypes: z.array(z.string()).optional(),
      filesRequiredOnCreate: z.boolean().optional(),
      imageSizes: z
        .array(
          z.object({
            name: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
            position: z
              .enum(['centre', 'center', 'top', 'right', 'bottom', 'left', 'entropy', 'attention'])
              .optional(),
            fit: z.enum(['cover', 'contain', 'fill', 'inside', 'outside']).optional(),
          }),
        )
        .optional(),
      adminThumbnail: z.union([z.string(), z.unknown()]).optional(),
      focalPoint: z.boolean().optional(),
      crop: z.boolean().optional(),
    }),
  ])
  .optional()

export type UploadConfig = z.infer<typeof UploadConfigSchema>

/**
 * Auth configuration
 */
export const AuthConfigSchema = z
  .union([
    z.boolean(),
    z.object({
      tokenExpiration: z.number().optional(),
      verify: z
        .union([
          z.boolean(),
          z.object({
            generateEmailHTML: z.unknown().optional(),
            generateEmailSubject: z.unknown().optional(),
          }),
        ])
        .optional(),
      maxLoginAttempts: z.number().optional(),
      lockTime: z.number().optional(),
      useAPIKey: z.boolean().optional(),
      depth: z.number().optional(),
      cookies: z
        .object({
          secure: z.boolean().optional(),
          sameSite: z.enum(['strict', 'lax', 'none']).or(z.boolean()).optional(),
          domain: z.string().optional(),
        })
        .optional(),
      forgotPassword: z
        .object({
          generateEmailHTML: z.unknown().optional(),
          generateEmailSubject: z.unknown().optional(),
        })
        .optional(),
      disableLocalStrategy: z.boolean().optional(),
      strategies: z.array(z.unknown()).optional(),
    }),
  ])
  .optional()

export type AuthConfig = z.infer<typeof AuthConfigSchema>

/**
 * TypeScript generation configuration
 */
export const TypeScriptConfigSchema = z
  .object({
    interface: z.string().optional(),
  })
  .optional()

export type TypeScriptConfig = z.infer<typeof TypeScriptConfigSchema>

/**
 * Collection structure schema
 *
 * Validates the structural parts of a collection configuration.
 * Does NOT validate: access, hooks, endpoints (functions)
 */
export const CollectionStructureSchema = z
  .object({
    // Required
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z][a-z0-9-]*$/, {
        message:
          'Slug must start with lowercase letter and contain only lowercase letters, numbers, and hyphens',
      }),

    // Labels
    labels: CollectionLabelsSchema,

    // Fields
    fields: z.array(FieldStructureSchema),

    // Timestamps
    timestamps: z.boolean().optional(),

    // Admin
    admin: CollectionAdminConfigSchema,

    // Versions
    versions: VersionConfigSchema,

    // Upload
    upload: UploadConfigSchema,

    // Auth
    auth: AuthConfigSchema,

    // TypeScript
    typescript: TypeScriptConfigSchema,

    // Custom ID type
    custom: z.record(z.string(), z.unknown()).optional(),

    // Database settings
    dbName: z.string().optional(),

    // GraphQL
    graphQL: z
      .union([
        z.boolean(),
        z.object({
          singularName: z.string().optional(),
          pluralName: z.string().optional(),
        }),
      ])
      .optional(),

    // Default sort
    defaultSort: z.string().optional(),

    // Note: access, hooks, endpoints are functions - not validated here
  })
  .passthrough()

/**
 * Collection structure type (without function properties)
 */
export interface CollectionStructure {
  slug: string
  labels?: CollectionLabels
  fields: FieldStructure[]
  timestamps?: boolean
  admin?: CollectionAdminConfig
  versions?: VersionConfig
  upload?: UploadConfig
  auth?: AuthConfig
  typescript?: TypeScriptConfig
  custom?: Record<string, unknown>
  dbName?: string
  graphQL?: boolean | { singularName?: string; pluralName?: string }
  defaultSort?: string
}

// ============================================
// GLOBAL STRUCTURE SCHEMAS
// ============================================

/**
 * Global labels configuration
 */
export const GlobalLabelsSchema = z
  .object({
    singular: z.string(),
    plural: z.string().optional(),
  })
  .optional()

export type GlobalLabels = z.infer<typeof GlobalLabelsSchema>

/**
 * Global admin configuration
 */
export const GlobalAdminConfigSchema = z
  .object({
    group: z.string().optional(),
    hidden: z.boolean().optional(),
    description: z.string().optional(),
    preview: z.unknown().optional(),
    livePreview: z
      .object({
        url: z.unknown().optional(),
        breakpoints: z
          .array(
            z.object({
              name: z.string(),
              width: z.number(),
              height: z.number(),
            }),
          )
          .optional(),
      })
      .optional(),
  })
  .passthrough()
  .optional()

export type GlobalAdminConfig = z.infer<typeof GlobalAdminConfigSchema>

/**
 * Global structure schema
 */
export const GlobalStructureSchema = z
  .object({
    // Required
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z][a-z0-9-]*$/, {
        message:
          'Slug must start with lowercase letter and contain only lowercase letters, numbers, and hyphens',
      }),

    // Labels
    label: z.string().optional(),
    labels: GlobalLabelsSchema,

    // Fields
    fields: z.array(FieldStructureSchema),

    // Admin
    admin: GlobalAdminConfigSchema,

    // Versions
    versions: VersionConfigSchema,

    // TypeScript
    typescript: TypeScriptConfigSchema,

    // Database
    dbName: z.string().optional(),

    // GraphQL
    graphQL: z
      .union([
        z.boolean(),
        z.object({
          name: z.string().optional(),
        }),
      ])
      .optional(),

    // Note: access, hooks, endpoints are functions - not validated here
  })
  .passthrough()

/**
 * Global structure type (without function properties)
 */
export interface GlobalStructure {
  slug: string
  label?: string
  labels?: GlobalLabels
  fields: FieldStructure[]
  admin?: GlobalAdminConfig
  versions?: VersionConfig
  typescript?: TypeScriptConfig
  dbName?: string
  graphQL?: boolean | { name?: string }
  custom?: Record<string, unknown>
}
