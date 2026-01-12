/**
 * CMS Global Contracts
 *
 * Schema definitions for CMS global configurations.
 * Globals are singleton documents (like site settings, navigation, etc.)
 */

import { z } from 'zod'
import { type Field, FieldSchema } from './field.js'

// =============================================================================
// Schema Version
// =============================================================================

export const GLOBAL_SCHEMA_VERSION = 1

// =============================================================================
// Global Labels
// =============================================================================

export const GlobalLabelsSchema = z
  .object({
    singular: z.string(),
    plural: z.string().optional(),
  })
  .optional()

export type GlobalLabels = z.infer<typeof GlobalLabelsSchema>

// =============================================================================
// Global Access
// =============================================================================

export const GlobalAccessSchema = z
  .object({
    /** Read access */
    read: z.unknown().optional(),
    /** Update access */
    update: z.unknown().optional(),
    /** Read versions */
    readVersions: z.unknown().optional(),
  })
  .optional()

export type GlobalAccess = z.infer<typeof GlobalAccessSchema>

// =============================================================================
// Global Hooks
// =============================================================================

export const GlobalHooksSchema = z
  .object({
    beforeValidate: z.array(z.unknown()).optional(),
    beforeChange: z.array(z.unknown()).optional(),
    afterChange: z.array(z.unknown()).optional(),
    beforeRead: z.array(z.unknown()).optional(),
    afterRead: z.array(z.unknown()).optional(),
  })
  .optional()

export type GlobalHooks = z.infer<typeof GlobalHooksSchema>

// =============================================================================
// Global Admin Config
// =============================================================================

export const GlobalAdminConfigSchema = z
  .object({
    /** Admin group name */
    group: z.string().optional(),

    /** Hide in admin */
    hidden: z.union([z.boolean(), z.function()]).optional(),

    /** Description text */
    description: z.string().optional(),

    /** Preview function */
    preview: z.function().optional(),

    /** Live preview configuration */
    livePreview: z
      .object({
        url: z.union([z.string(), z.function()]).optional(),
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

    /** Custom components */
    components: z
      .object({
        elements: z
          .object({
            SaveButton: z.unknown().optional(),
            SaveDraftButton: z.unknown().optional(),
            PublishButton: z.unknown().optional(),
            PreviewButton: z.unknown().optional(),
          })
          .optional(),
        views: z
          .object({
            Edit: z.unknown().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .passthrough()
  .optional()

export type GlobalAdminConfig = z.infer<typeof GlobalAdminConfigSchema>

// =============================================================================
// Global Versions Config
// =============================================================================

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
  .optional()

export type GlobalVersionsConfig = z.infer<typeof GlobalVersionsConfigSchema>

// =============================================================================
// Global Config Schema
// =============================================================================

export const GlobalConfigSchema = z
  .object({
    /** Schema version */
    schemaVersion: z.number().int().default(GLOBAL_SCHEMA_VERSION).optional(),

    /** Global slug (URL-safe identifier) */
    slug: z.string().regex(/^[a-z][a-z0-9-]*$/),

    /** Display labels */
    labels: GlobalLabelsSchema,

    /** Display label (shorthand) */
    label: z.string().optional(),

    /** Field definitions */
    fields: z.array(FieldSchema),

    /** Access control */
    access: GlobalAccessSchema,

    /** Lifecycle hooks */
    hooks: GlobalHooksSchema,

    /** Admin UI configuration */
    admin: GlobalAdminConfigSchema,

    /** Versions configuration */
    versions: GlobalVersionsConfigSchema,

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

    /** Database collection name override */
    dbName: z.string().optional(),

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
          name: z.string().optional(),
        }),
      ])
      .optional(),
  })
  .passthrough()

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>

// =============================================================================
// Sanitized Global Config
// =============================================================================

export const SanitizedGlobalConfigSchema = GlobalConfigSchema.extend({
  /** Processed fields with defaults applied */
  fields: z.array(FieldSchema),

  /** Flattened field paths */
  flattenedFields: z.array(FieldSchema).optional(),
})

export type SanitizedGlobalConfig = z.infer<typeof SanitizedGlobalConfigSchema>

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a basic global config with defaults
 */
export function createGlobalConfig(
  slug: string,
  fields: Field[],
  options?: Partial<Omit<GlobalConfig, 'slug' | 'fields'>>,
): GlobalConfig {
  return {
    schemaVersion: GLOBAL_SCHEMA_VERSION,
    slug,
    fields,
    ...options,
  }
}
