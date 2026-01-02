/**
 * Legacy Compatibility Types
 *
 * Types maintained for backward compatibility.
 * These are deprecated and will be removed in v1.0.0.
 *
 * @module @revealui/cms/types/legacy
 */

import type { Field, CollectionHooks } from '@revealui/schema/cms'

// =============================================================================
// LEGACY ALIASES
// =============================================================================

/** @deprecated Use Field from @revealui/schema/cms instead */
export type RevealField = Field

/** @deprecated Use CollectionHooks from @revealui/schema/cms */
export type LegacyCollectionHooks = CollectionHooks

// =============================================================================
// BLOCK TYPE
// =============================================================================

/** Block type for legacy compatibility */
export type Block = {
  slug: string
  fields: Field[]
  interfaceName?: string
  labels?: {
    singular?: string
    plural?: string
  }
  name?: string
  admin?: {
    components?: {
      Block?: unknown
    }
  }
  imageURL?: string
  imageAltText?: string
  graphQL?: {
    singularName?: string
  }
}

// =============================================================================
// FIELD TYPE ALIASES
// =============================================================================

export type CheckboxField = Field & { type: 'checkbox' }
export type BlocksField = Field & { type: 'blocks'; blocks: Block[] }

// =============================================================================
// REVEALUI BLOCK TYPE
// =============================================================================

/**
 * RevealUI Block - extended block type with RevealUI features
 */
export interface RevealUIBlock extends Block {
  /** RevealUI-specific extensions */
  revealUI?: {
    /** Custom preview component */
    preview?: unknown
    /** Custom edit component */
    editor?: unknown
    /** Block category */
    category?: string
    /** Icon for admin UI */
    icon?: string
    /** Required permissions to access this block */
    permissions?: string[]
    /** Whether this block is tenant-scoped */
    tenantScoped?: boolean
  }
}

// =============================================================================
// INTERNAL TYPES (Payload compatibility)
// =============================================================================

/**
 * Client-side configuration type
 * @internal
 */
export interface ClientConfig {
  serverURL: string
  routes?: {
    admin?: string
    api?: string
  }
  collections?: Array<{ slug: string }>
  globals?: Array<{ slug: string }>
}

/**
 * Client-side collection configuration
 * @internal
 */
export interface ClientCollectionConfig {
  slug: string
  labels?: {
    singular?: string
    plural?: string
  }
  admin?: {
    useAsTitle?: string
    defaultColumns?: string[]
    listSearchableFields?: string[]
  }
}

/**
 * Traverse fields arguments
 * @internal
 */
export interface RevealUITraverseFieldsArgs {
  fields: Field[]
  path?: string
  callback?: (field: Field, path: string) => void | boolean
  data?: Record<string, unknown>
}

/**
 * Traverse fields result
 * @internal
 */
export interface RevealUITraverseFieldsResult {
  traversed: number
  found: Field[]
  data?: Record<string, unknown>
  errors?: Array<{ field: string; message: string }>
}

/**
 * Dependency check arguments
 * @internal
 */
export interface RevealUIDependencyCheckArgs {
  field: Field
  fields: Field[]
  path?: string
}

/**
 * Schema generation arguments
 * @internal
 */
export interface RevealUISchemaArgs {
  collections?: Array<{ slug: string; fields: Field[] }>
  globals?: Array<{ slug: string; fields: Field[] }>
  outputFile?: string
}

/**
 * Rich text adapter interface
 * @internal
 */
export interface RevealUIRichTextAdapter {
  name: string
  features?: Array<{
    key: string
    enabled: boolean
  }>
  serialize?: (content: unknown) => string
  deserialize?: (content: string) => unknown
}
