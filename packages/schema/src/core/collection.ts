/**
 * CMS Collection Contracts
 *
 * Schema definitions for CMS collection configurations.
 * Collections are the primary data model abstraction in RevealUI CMS.
 */

import { z } from 'zod'
import { type Field, FieldSchema } from './field.js'

// =============================================================================
// Schema Version
// =============================================================================

export const COLLECTION_SCHEMA_VERSION = 1

// =============================================================================
// Collection Labels
// =============================================================================

export const CollectionLabelsSchema = z
  .object({
    singular: z.string(),
    plural: z.string(),
  })
  .optional()

export type CollectionLabels = z.infer<typeof CollectionLabelsSchema>

// =============================================================================
// Collection Access
// =============================================================================

// Access functions are runtime functions, typed as unknown for schema flexibility
// Actual typing is enforced at runtime
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
  .optional()

export type CollectionAccess = z.infer<typeof CollectionAccessSchema>

// =============================================================================
// Collection Hooks
// =============================================================================

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
  .optional()

export type CollectionHooks = z.infer<typeof CollectionHooksSchema>

// =============================================================================
// Collection Admin Config
// =============================================================================

export const CollectionAdminConfigSchema = z
  .object({
    /** Field to use as document title */
    useAsTitle: z.string().optional(),

    /** Default columns in list view */
    defaultColumns: z.array(z.string()).optional(),

    /** Admin group name */
    group: z.string().optional(),

    /** Preview function */
    preview: z.function().optional(),

    /** Hide in admin */
    hidden: z.union([z.boolean(), z.function()]).optional(),

    /** Description text */
    description: z.string().optional(),

    /** Searchable fields in list view */
    listSearchableFields: z.array(z.string()).optional(),

    /** Live preview configuration */
    livePreview: z
      .object({
        url: z.union([z.string(), z.function()]).optional(),
        collections: z.array(z.string()).optional(),
        globals: z.array(z.string()).optional(),
        breakpoints: z
          .array(
            z.object({
              name: z.string(),
              width: z.number(),
              height: z.number(),
              label: z.string().optional(),
            }),
          )
          .optional(),
      })
      .optional(),

    /** Pagination settings */
    pagination: z
      .object({
        defaultLimit: z.number().int().optional(),
        limits: z.array(z.number().int()).optional(),
      })
      .optional(),

    /** Enable drag-and-drop sorting */
    enableRichTextLink: z.boolean().optional(),
    enableRichTextRelationship: z.boolean().optional(),

    /** Custom components */
    components: z
      .object({
        BeforeList: z.unknown().optional(),
        BeforeListTable: z.unknown().optional(),
        AfterList: z.unknown().optional(),
        AfterListTable: z.unknown().optional(),
        edit: z
          .object({
            SaveButton: z.unknown().optional(),
            SaveDraftButton: z.unknown().optional(),
            PublishButton: z.unknown().optional(),
            PreviewButton: z.unknown().optional(),
            Upload: z.unknown().optional(),
          })
          .optional(),
        views: z
          .object({
            Edit: z.unknown().optional(),
            List: z.unknown().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .passthrough()
  .optional()

export type CollectionAdminConfig = z.infer<typeof CollectionAdminConfigSchema>

// =============================================================================
// Upload Config
// =============================================================================

export const UploadConfigSchema = z
  .object({
    /** Static URL path */
    staticURL: z.string().optional(),

    /** Static directory path */
    staticDir: z.string().optional(),

    /** Disable local storage */
    disableLocalStorage: z.boolean().optional(),

    /** Admin thumbnail for the collection */
    adminThumbnail: z.union([z.string(), z.function()]).optional(),

    /** Allowed MIME types */
    mimeTypes: z.array(z.string()).optional(),

    /** File size limit in bytes */
    filesRequiredOnCreate: z.boolean().optional(),

    /** Image sizes */
    imageSizes: z
      .array(
        z.object({
          name: z.string(),
          width: z.number().int().optional(),
          height: z.number().int().optional(),
          position: z.string().optional(),
          formatOptions: z.record(z.string(), z.unknown()).optional(),
          withoutEnlargement: z.boolean().optional(),
          withoutReduction: z.boolean().optional(),
          crop: z.string().optional(),
        }),
      )
      .optional(),

    /** Format options */
    formatOptions: z.record(z.string(), z.unknown()).optional(),

    /** Resize options */
    resizeOptions: z
      .object({
        width: z.number().int().optional(),
        height: z.number().int().optional(),
        fit: z.string().optional(),
        position: z.string().optional(),
        background: z.string().optional(),
        withoutEnlargement: z.boolean().optional(),
        withoutReduction: z.boolean().optional(),
      })
      .optional(),

    /** Enable focal point */
    focalPoint: z.boolean().optional(),

    /** Enable cropping */
    crop: z.boolean().optional(),

    /** External file storage */
    externalFileHeaderFilter: z.function().optional(),

    /** Handlers */
    handlers: z.array(z.unknown()).optional(),
  })
  .optional()

export type UploadConfig = z.infer<typeof UploadConfigSchema>

// =============================================================================
// Auth Config
// =============================================================================

export const AuthConfigSchema = z
  .object({
    /** Use API key authentication */
    useAPIKey: z.boolean().optional(),

    /** Token expiration in seconds */
    tokenExpiration: z.number().int().optional(),

    /** Max login attempts */
    maxLoginAttempts: z.number().int().optional(),

    /** Lockout interval in seconds */
    lockTime: z.number().int().optional(),

    /** Cookie settings */
    cookies: z
      .object({
        secure: z.boolean().optional(),
        sameSite: z.union([z.literal('strict'), z.literal('lax'), z.literal('none')]).optional(),
        domain: z.string().optional(),
      })
      .optional(),

    /** Verify email */
    verify: z
      .union([
        z.boolean(),
        z.object({
          generateEmailHTML: z.function().optional(),
          generateEmailSubject: z.function().optional(),
        }),
      ])
      .optional(),

    /** Forgot password */
    forgotPassword: z
      .object({
        generateEmailHTML: z.function().optional(),
        generateEmailSubject: z.function().optional(),
      })
      .optional(),

    /** Strategies */
    strategies: z
      .array(
        z.object({
          name: z.string(),
          strategy: z.function(),
        }),
      )
      .optional(),
  })
  .optional()

export type AuthConfig = z.infer<typeof AuthConfigSchema>

// =============================================================================
// Versions Config
// =============================================================================

export const VersionsConfigSchema = z
  .union([
    z.boolean(),
    z.object({
      /** Max versions to keep */
      maxPerDoc: z.number().int().optional(),

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
  .optional()

export type VersionsConfig = z.infer<typeof VersionsConfigSchema>

// =============================================================================
// Collection Config Schema
// =============================================================================

export const CollectionConfigSchema = z
  .object({
    /** Schema version */
    schemaVersion: z.number().int().default(COLLECTION_SCHEMA_VERSION).optional(),

    /** Collection slug (URL-safe identifier) */
    slug: z.string().regex(/^[a-z][a-z0-9-]*$/),

    /** Display labels */
    labels: CollectionLabelsSchema,

    /** Field definitions */
    fields: z.array(FieldSchema),

    /** Access control */
    access: CollectionAccessSchema,

    /** Lifecycle hooks */
    hooks: CollectionHooksSchema,

    /** Admin UI configuration */
    admin: CollectionAdminConfigSchema,

    /** Enable timestamps (createdAt, updatedAt) */
    timestamps: z.boolean().default(true).optional(),

    /** Upload configuration (makes this a media collection) */
    upload: UploadConfigSchema,

    /** Auth configuration (makes this an auth collection) */
    auth: AuthConfigSchema,

    /** Versions configuration */
    versions: VersionsConfigSchema,

    /** Custom endpoints */
    endpoints: z
      .array(
        z.object({
          path: z.string(),
          method: z.enum(['get', 'post', 'put', 'patch', 'delete', 'connect', 'options', 'head']),
          handler: z.function(),
          root: z.boolean().optional(),
        }),
      )
      .optional(),

    /** Default sort field */
    defaultSort: z.string().optional(),

    /** Database collection name override */
    dbName: z.string().optional(),

    /** Disable duplicate action */
    disableDuplicate: z.boolean().optional(),

    /** Lock documents for editing */
    lockDocuments: z
      .union([
        z.boolean(),
        z.object({
          duration: z.number().int(),
        }),
      ])
      .optional(),

    /** TypeScript interface name override */
    typescript: z
      .object({
        interface: z.string().optional(),
      })
      .optional(),

    /** GraphQL configuration */
    graphQL: z
      .union([
        z.literal(false),
        z.object({
          singularName: z.string().optional(),
          pluralName: z.string().optional(),
        }),
      ])
      .optional(),
  })
  .passthrough() // Allow additional properties for extensibility

export type CollectionConfig = z.infer<typeof CollectionConfigSchema>

// =============================================================================
// Sanitized Collection Config (after processing)
// =============================================================================

export const SanitizedCollectionConfigSchema = CollectionConfigSchema.extend({
  /** Processed fields with defaults applied */
  fields: z.array(FieldSchema),

  /** Flattened field paths */
  flattenedFields: z.array(FieldSchema).optional(),
})

export type SanitizedCollectionConfig = z.infer<typeof SanitizedCollectionConfigSchema>

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a basic collection config with defaults
 */
export function createCollectionConfig(
  slug: string,
  fields: Field[],
  options?: Partial<Omit<CollectionConfig, 'slug' | 'fields'>>,
): CollectionConfig {
  return {
    schemaVersion: COLLECTION_SCHEMA_VERSION,
    slug,
    fields,
    timestamps: true,
    ...options,
  }
}

/**
 * Creates an auth-enabled collection config
 */
export function createAuthCollectionConfig(
  slug: string,
  fields: Field[],
  authOptions?: AuthConfig,
  options?: Partial<Omit<CollectionConfig, 'slug' | 'fields' | 'auth'>>,
): CollectionConfig {
  return {
    schemaVersion: COLLECTION_SCHEMA_VERSION,
    slug,
    fields: [{ name: 'email', type: 'email', required: true, unique: true }, ...fields],
    auth: authOptions ?? {},
    timestamps: true,
    ...options,
  }
}

/**
 * Creates an upload-enabled collection config
 */
export function createUploadCollectionConfig(
  slug: string,
  fields: Field[],
  uploadOptions?: UploadConfig,
  options?: Partial<Omit<CollectionConfig, 'slug' | 'fields' | 'upload'>>,
): CollectionConfig {
  return {
    schemaVersion: COLLECTION_SCHEMA_VERSION,
    slug,
    fields,
    upload: uploadOptions ?? {},
    timestamps: true,
    ...options,
  }
}
