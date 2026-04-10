/**
 * Structure Schemas (Zod)
 *
 * These schemas validate the STRUCTURE of admin configurations.
 *
 * IMPORTANT: These schemas do NOT validate function types (hooks, access, validate).
 * Function types are handled by TypeScript contracts in functions.ts.
 *
 * Why this split?
 * 1. Zod's z.function() only validates callability, not signatures
 * 2. Generic type parameters (e.g., <T>) cannot be represented in Zod
 * 3. Complex return types with conditional types don't work in Zod
 *
 * @module @revealui/contracts/core/contracts/structure
 */

import { z } from 'zod/v4';

// ============================================
// SCHEMA VERSIONS
// ============================================

export const FIELD_SCHEMA_VERSION = 1;
export const COLLECTION_SCHEMA_VERSION = 1;
export const GLOBAL_SCHEMA_VERSION = 1;

// ============================================
// FIELD STRUCTURE SCHEMAS
// ============================================

/**
 * Valid field types in RevealUI admin
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
]);

export type FieldType = z.infer<typeof FieldTypeSchema>;

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
  .optional();

export type FieldAdminConfig = z.infer<typeof FieldAdminConfigSchema>;

/**
 * Option for select/radio fields
 */
export const FieldOptionSchema = z.union([
  z.string(),
  z.object({
    label: z.string(),
    value: z.string(),
  }),
]);

export type FieldOption = z.infer<typeof FieldOptionSchema>;

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
  .passthrough();

export type BlockDefinition = z.infer<typeof BlockDefinitionSchema>;

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
  .passthrough();

export type TabDefinition = z.infer<typeof TabDefinitionSchema>;

// =============================================================================
// FIELD ACCESS/HOOKS SCHEMAS
// =============================================================================

/**
 * Field access control schema
 *
 * Access functions are runtime functions, typed as unknown for schema flexibility
 */
export const FieldAccessConfigSchema = z
  .object({
    create: z.unknown().optional(),
    read: z.unknown().optional(),
    update: z.unknown().optional(),
  })
  .optional();

export type FieldAccessConfig = z.infer<typeof FieldAccessConfigSchema>;

/**
 * Field hooks schema
 *
 * Hooks are typed as unknown arrays because they're runtime functions
 */
export const FieldHooksConfigSchema = z
  .object({
    beforeChange: z.array(z.unknown()).optional(),
    afterChange: z.array(z.unknown()).optional(),
    beforeValidate: z.array(z.unknown()).optional(),
    afterRead: z.array(z.unknown()).optional(),
  })
  .optional();

export type FieldHooksConfig = z.infer<typeof FieldHooksConfigSchema>;

// =============================================================================
// BASE FIELD STRUCTURE
// =============================================================================

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
    label: z.union([z.string(), z.literal(false)]).optional(),

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
  .passthrough();

/**
 * Field structure type (without function properties)
 */
export interface FieldStructure {
  type: FieldType;
  name?: string | undefined;
  label?: string | false;
  labels?:
    | {
        singular?: string | undefined;
        plural?: string | undefined;
      }
    | undefined;
  required?: boolean | undefined;
  unique?: boolean | undefined;
  index?: boolean | undefined;
  localized?: boolean | undefined;
  hidden?: boolean | undefined;
  saveToJWT?: boolean | string | undefined;
  minLength?: number | undefined;
  maxLength?: number | undefined;
  min?: number | undefined;
  max?: number | undefined;
  minRows?: number | undefined;
  maxRows?: number | undefined;
  relationTo?: string | string[] | undefined;
  hasMany?: boolean | undefined;
  maxDepth?: number | undefined;
  options?: FieldOption[] | undefined;
  defaultValue?: unknown;
  admin?: FieldAdminConfig | undefined;
  fields?: FieldStructure[] | undefined;
  blocks?: BlockDefinition[] | undefined;
  tabs?: TabDefinition[] | undefined;
  interfaceName?: string | undefined;
  custom?: Record<string, unknown> | undefined;
}

// =============================================================================
// FULL FIELD SCHEMA (includes access/hooks)
// =============================================================================

/**
 * Base field properties schema (non-recursive parts)
 *
 * This includes all field properties from FieldStructureSchema plus access/hooks
 * but excludes nested fields/blocks/tabs which require recursion.
 */
const BaseFieldPropertiesSchema = z
  .object({
    // Include all properties from FieldStructureSchema
    type: FieldTypeSchema,
    name: z.string().min(1).optional(),
    label: z.union([z.string(), z.literal(false)]).optional(),
    labels: z
      .object({
        singular: z.string().optional(),
        plural: z.string().optional(),
      })
      .optional(),
    required: z.boolean().optional(),
    unique: z.boolean().optional(),
    index: z.boolean().optional(),
    localized: z.boolean().optional(),
    hidden: z.boolean().optional(),
    saveToJWT: z.union([z.boolean(), z.string()]).optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    minRows: z.number().optional(),
    maxRows: z.number().optional(),
    relationTo: z.union([z.string(), z.array(z.string())]).optional(),
    hasMany: z.boolean().optional(),
    maxDepth: z.number().optional(),
    depth: z.number().optional(),
    options: z.array(FieldOptionSchema).optional(),
    defaultValue: z.unknown().optional(),
    admin: FieldAdminConfigSchema,
    interfaceName: z.string().optional(),
    custom: z.record(z.string(), z.unknown()).optional(),
    // Add function properties
    schemaVersion: z.number().int().default(FIELD_SCHEMA_VERSION).optional(),
    access: FieldAccessConfigSchema,
    hooks: FieldHooksConfigSchema,
    validate: z.unknown().optional(),
    condition: z.unknown().optional(),
    filterOptions: z.unknown().optional(),
    editor: z.unknown().optional(),
  })
  .passthrough();

/**
 * Full Field Schema (recursive - includes nested fields)
 *
 * This is the complete field schema that includes access, hooks, and nested fields.
 * For structure-only validation, use FieldStructureSchema.
 */
export const FieldSchema: z.ZodType<FieldStructure> = z.lazy(() =>
  BaseFieldPropertiesSchema.extend({
    /** Nested fields (recursive) */
    fields: z.array(FieldSchema).optional(),
    /** Tabs (for tabs field) */
    tabs: z.array(TabDefinitionSchema).optional(),
  }),
) as z.ZodType<FieldStructure>;

// =============================================================================
// SPECIFIC FIELD TYPE SCHEMAS
// =============================================================================

/**
 * Text field schema
 */
export const TextFieldSchema = BaseFieldPropertiesSchema.extend({
  type: z.literal('text'),
  name: z.string(), // Required for text fields
});

/**
 * Number field schema
 */
export const NumberFieldSchema = BaseFieldPropertiesSchema.extend({
  type: z.literal('number'),
  name: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
});

/**
 * Relationship field schema
 */
export const RelationshipFieldSchema = BaseFieldPropertiesSchema.extend({
  type: z.literal('relationship'),
  name: z.string(),
  relationTo: z.union([z.string(), z.array(z.string())]),
});

/**
 * Array field schema (recursive)
 */
export const ArrayFieldSchema = z.lazy(() =>
  BaseFieldPropertiesSchema.extend({
    type: z.literal('array'),
    name: z.string(),
    fields: z.array(FieldSchema),
  }),
);

/**
 * Group field schema (recursive)
 */
export const GroupFieldSchema = z.lazy(() =>
  BaseFieldPropertiesSchema.extend({
    type: z.literal('group'),
    name: z.string(),
    fields: z.array(FieldSchema),
  }),
);

/**
 * Select field schema
 */
export const SelectFieldSchema = BaseFieldPropertiesSchema.extend({
  type: z.literal('select'),
  name: z.string(),
  options: z.array(FieldOptionSchema),
});

/**
 * Row field schema (layout field - recursive)
 */
export const RowFieldSchema = z.lazy(() =>
  BaseFieldPropertiesSchema.extend({
    type: z.literal('row'),
    fields: z.array(FieldSchema),
  }),
);

/**
 * Tabs field schema (layout field - recursive)
 */
export const TabsFieldSchema = z.lazy(() =>
  BaseFieldPropertiesSchema.extend({
    type: z.literal('tabs'),
    tabs: z.array(TabDefinitionSchema),
  }),
);

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
  .optional();

export type CollectionLabels = z.infer<typeof CollectionLabelsSchema>;

/**
 * Collection access control schema
 *
 * Access functions are runtime functions, typed as unknown for schema flexibility
 */
export const CollectionAccessSchema = z
  .object({
    /** Create access */
    create: z.unknown().optional(),
    /** Read access */
    read: z.unknown().optional(),
    /** Update access */
    update: z.unknown().optional(),
    /** Delete access */
    delete: z.unknown().optional(),
    /** Admin panel access */
    admin: z.unknown().optional(),
    /** Unlock (for locked documents) */
    unlock: z.unknown().optional(),
    /** Read versions */
    readVersions: z.unknown().optional(),
  })
  .optional();

export type CollectionAccess = z.infer<typeof CollectionAccessSchema>;

/**
 * Collection hooks schema
 *
 * Hooks are typed as unknown arrays because they're runtime functions
 */
export const CollectionHooksSchema = z
  .object({
    // Document lifecycle hooks
    beforeOperation: z.array(z.unknown()).optional(),
    afterOperation: z.array(z.unknown()).optional(),
    beforeValidate: z.array(z.unknown()).optional(),
    beforeChange: z.array(z.unknown()).optional(),
    afterChange: z.array(z.unknown()).optional(),
    beforeRead: z.array(z.unknown()).optional(),
    afterRead: z.array(z.unknown()).optional(),
    beforeDelete: z.array(z.unknown()).optional(),
    afterDelete: z.array(z.unknown()).optional(),
    // Auth hooks (for auth collections)
    beforeLogin: z.array(z.unknown()).optional(),
    afterLogin: z.array(z.unknown()).optional(),
    afterLogout: z.array(z.unknown()).optional(),
    afterRefresh: z.array(z.unknown()).optional(),
    afterMe: z.array(z.unknown()).optional(),
    afterForgotPassword: z.array(z.unknown()).optional(),
  })
  .optional();

export type CollectionHooks = z.infer<typeof CollectionHooksSchema>;

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
  .optional();

export type CollectionAdminConfig = z.infer<typeof CollectionAdminConfigSchema>;

/**
 * Versions configuration schema (for collections)
 */
export const VersionsConfigSchema = z
  .union([
    z.boolean(),
    z.object({
      maxPerDoc: z.number().int().optional(),
      drafts: z
        .union([
          z.boolean(),
          z.object({
            autosave: z
              .union([
                z.boolean(),
                z.object({
                  interval: z.number().int().optional(),
                }),
              ])
              .optional(),
            validate: z.boolean().optional(),
          }),
        ])
        .optional(),
    }),
  ])
  .optional();

export type VersionConfig = z.infer<typeof VersionsConfigSchema>;

// Alias for backward compatibility - use VersionsConfigSchema for collections/globals
export const VersionConfigSchema = VersionsConfigSchema;

/**
 * Global versions configuration schema
 * (Same as VersionsConfigSchema but exported separately for clarity)
 */
export const GlobalVersionsConfigSchema = z
  .union([
    z.boolean(),
    z.object({
      /** Max versions to keep */
      max: z.number().int().optional(),
      /** Enable drafts */
      drafts: z
        .union([
          z.boolean(),
          z.object({
            autosave: z
              .union([
                z.boolean(),
                z.object({
                  interval: z.number().int().optional(),
                }),
              ])
              .optional(),
            validate: z.boolean().optional(),
          }),
        ])
        .optional(),
    }),
  ])
  .optional();

export type GlobalVersionsConfig = z.infer<typeof GlobalVersionsConfigSchema>;

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
  .optional();

export type UploadConfig = z.infer<typeof UploadConfigSchema>;

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
  .optional();

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

/**
 * TypeScript generation configuration
 */
export const TypeScriptConfigSchema = z
  .object({
    interface: z.string().optional(),
  })
  .optional();

export type TypeScriptConfig = z.infer<typeof TypeScriptConfigSchema>;

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
    versions: VersionsConfigSchema,

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

    // Default sort
    defaultSort: z.string().optional(),

    // Note: access, hooks, endpoints are functions - not validated here
  })
  .passthrough();

/**
 * Collection structure type (without function properties)
 */
export interface CollectionStructure {
  slug: string;
  labels?: CollectionLabels | undefined;
  fields: FieldStructure[];
  timestamps?: boolean | undefined;
  admin?: CollectionAdminConfig | undefined;
  versions?: VersionConfig | undefined;
  upload?: UploadConfig | undefined;
  auth?: AuthConfig | undefined;
  typescript?: TypeScriptConfig | undefined;
  custom?: Record<string, unknown> | undefined;
  dbName?: string | undefined;
  defaultSort?: string | undefined;
}

/**
 * Full Collection Config Schema (includes access/hooks)
 *
 * This is the complete collection config schema including function properties.
 * For structure-only validation, use CollectionStructureSchema.
 */
export const CollectionConfigSchema = CollectionStructureSchema.extend({
  /** Access control */
  access: CollectionAccessSchema,
  /** Lifecycle hooks */
  hooks: CollectionHooksSchema,
  /** Custom endpoints */
  endpoints: z
    .array(
      z.object({
        path: z.string(),
        method: z.enum(['get', 'post', 'put', 'patch', 'delete', 'connect', 'options', 'head']),
        handler: z.unknown(), // Function - not validated
        root: z.boolean().optional(),
      }),
    )
    .optional(),
  /** Schema version */
  schemaVersion: z.number().int().default(COLLECTION_SCHEMA_VERSION).optional(),
}).passthrough();

/**
 * Sanitized Collection Config Schema (after processing)
 */
export const SanitizedCollectionConfigSchema = CollectionConfigSchema.extend({
  /** Flattened field paths */
  flattenedFields: z.array(FieldStructureSchema).optional(),
});

export type SanitizedCollectionConfig = z.infer<typeof SanitizedCollectionConfigSchema>;

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
  .optional();

export type GlobalLabels = z.infer<typeof GlobalLabelsSchema>;

/**
 * Global access control schema
 */
export const GlobalAccessSchema = z
  .object({
    /** Read access */
    read: z.unknown().optional(),
    /** Update access */
    update: z.unknown().optional(),
    /** Read versions */
    readVersions: z.unknown().optional(),
  })
  .optional();

export type GlobalAccess = z.infer<typeof GlobalAccessSchema>;

/**
 * Global hooks schema
 */
export const GlobalHooksSchema = z
  .object({
    beforeValidate: z.array(z.unknown()).optional(),
    beforeChange: z.array(z.unknown()).optional(),
    afterChange: z.array(z.unknown()).optional(),
    beforeRead: z.array(z.unknown()).optional(),
    afterRead: z.array(z.unknown()).optional(),
  })
  .optional();

export type GlobalHooks = z.infer<typeof GlobalHooksSchema>;

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
  .optional();

export type GlobalAdminConfig = z.infer<typeof GlobalAdminConfigSchema>;

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
    versions: VersionsConfigSchema,

    // TypeScript
    typescript: TypeScriptConfigSchema,

    // Database
    dbName: z.string().optional(),

    // Note: access, hooks, endpoints are functions - not validated here
  })
  .passthrough();

/**
 * Global structure type (without function properties)
 */
export interface GlobalStructure {
  slug: string;
  label?: string | undefined;
  labels?: GlobalLabels | undefined;
  fields: FieldStructure[];
  admin?: GlobalAdminConfig | undefined;
  versions?: VersionConfig | undefined;
  typescript?: TypeScriptConfig | undefined;
  dbName?: string | undefined;
  custom?: Record<string, unknown> | undefined;
}

/**
 * Full Global Config Schema (includes access/hooks)
 *
 * This is the complete global config schema including function properties.
 * For structure-only validation, use GlobalStructureSchema.
 */
export const GlobalConfigSchema = GlobalStructureSchema.extend({
  /** Access control */
  access: GlobalAccessSchema,
  /** Lifecycle hooks */
  hooks: GlobalHooksSchema,
  /** Versions config (use GlobalVersionsConfigSchema) */
  versions: GlobalVersionsConfigSchema,
  /** Custom endpoints */
  endpoints: z
    .array(
      z.object({
        path: z.string(),
        method: z.enum(['get', 'post', 'put', 'patch', 'delete', 'connect', 'options', 'head']),
        handler: z.unknown(), // Function - not validated
        root: z.boolean().optional(),
      }),
    )
    .optional(),
  /** Schema version */
  schemaVersion: z.number().int().default(GLOBAL_SCHEMA_VERSION).optional(),
}).passthrough();

/**
 * Sanitized Global Config Schema (after processing)
 */
export const SanitizedGlobalConfigSchema = GlobalConfigSchema.extend({
  /** Flattened field paths */
  flattenedFields: z.array(FieldStructureSchema).optional(),
});

export type SanitizedGlobalConfig = z.infer<typeof SanitizedGlobalConfigSchema>;

// ============================================
// INFERRED FIELD TYPES
// ============================================

/**
 * Text field type
 */
export type TextField = z.infer<typeof TextFieldSchema>;

/**
 * Number field type
 */
export type NumberField = z.infer<typeof NumberFieldSchema>;

/**
 * Relationship field type
 */
export type RelationshipField = z.infer<typeof RelationshipFieldSchema>;

/**
 * Array field type
 */
export type ArrayField = z.infer<typeof ArrayFieldSchema>;

/**
 * Group field type
 */
export type GroupField = z.infer<typeof GroupFieldSchema>;

/**
 * Select field type
 */
export type SelectField = z.infer<typeof SelectFieldSchema>;

/**
 * Tabs field type
 */
export type TabsField = z.infer<typeof TabsFieldSchema>;

/**
 * Row field type
 */
export type RowField = z.infer<typeof RowFieldSchema>;
