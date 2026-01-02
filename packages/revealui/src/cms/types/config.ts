/**
 * RevealUI Configuration Types
 *
 * Defines RevealUI-specific configuration interfaces that extend
 * the base CMS configuration types.
 *
 * @module @revealui/cms/types/config
 */

import type { CollectionConfig, GlobalConfig } from '@revealui/schema/cms'
import type { RevealUIInstance } from './runtime'
import type { DatabaseResult } from './runtime'
import type { RevealRequest } from './request'
import type { RevealDocument, RevealDataObject } from './query'
import type { RevealUser } from './user'

// =============================================================================
// HOOK TYPES
// =============================================================================

/** RevealUI's hook context */
export interface RevealHookContext {
  revealui: RevealUIInstance
  collection?: string
  global?: string
  operation: 'create' | 'read' | 'update' | 'delete'
  previousDoc?: RevealDocument
  req?: RevealRequest
}

/** After change hook function signature */
export type RevealAfterChangeHook<T = unknown> = (args: {
  doc: T
  context?: RevealHookContext
  req: RevealRequest
  operation: 'create' | 'update' | 'delete' | string
  previousDoc?: T
  collection?: string
}) => Promise<T | undefined> | T | undefined

/** Alias for global hooks */
export type GlobalAfterChangeHook<T = unknown> = RevealAfterChangeHook<T>

/** Before change hook function signature */
export type RevealBeforeChangeHook<T = unknown> = (args: {
  data: T
  context?: RevealHookContext
  req: RevealRequest
  operation: 'create' | 'update' | string
  originalDoc?: T
  collection?: string
}) => Promise<T> | T

/** After read hook function signature */
export type RevealAfterReadHook = (args: {
  doc: RevealDocument
  context?: RevealHookContext
  req: RevealRequest
}) => Promise<RevealDocument> | RevealDocument

/** RevealUI's collection hooks */
export interface RevealCollectionHooks {
  beforeChange?: RevealBeforeChangeHook[]
  afterChange?: RevealAfterChangeHook[]
  beforeRead?: ((context: RevealHookContext) => Promise<void> | void)[]
  afterRead?: RevealAfterReadHook[]
  beforeDelete?: ((args: {
    req: RevealRequest
    id: string | number
    context?: RevealHookContext
  }) => Promise<void> | void)[]
  afterDelete?: ((args: {
    doc: RevealDocument
    id: string | number
    req: RevealRequest
    context?: RevealHookContext
  }) => Promise<void> | void)[]
  afterLogin?: ((args: { req: RevealRequest; user: RevealUser }) => Promise<void> | void)[]
}

// =============================================================================
// CONFIG TYPES
// =============================================================================

/** RevealUI's main configuration */
export interface RevealConfig {
  collections?: RevealCollectionConfig[]
  globals?: RevealGlobalConfig[]
  serverURL?: string
  secret?: string
  db?: {
    query: (query: string, values?: unknown[]) => Promise<DatabaseResult>
    init?: () => Promise<void>
    connect?: () => Promise<void>
  } | null
  admin?: {
    user?: string
    components?: {
      beforeNavLinks?: string[]
      beforeDashboard?: string[]
      beforeLogin?: string[]
      graphics?: {
        Icon?: string
        Logo?: string
      }
    }
    meta?: {
      titleSuffix?: string
      icons?: Array<{
        url: string
        rel?: string
        sizes?: string
        type?: string
      }>
    }
    importMap?: {
      autoGenerate?: boolean
      baseDir?: string
    }
    livePreview?: {
      url?: (params: { data: unknown; locale?: string }) => string
    }
  }
  onInit?: (revealui: RevealUIInstance) => Promise<void> | void
  /** RevealUI-specific configuration options */
  revealUI?: {
    multiTenant?: boolean
    auditLog?: boolean
    permissions?: string[]
    theme?: string
  }
}

/**
 * Extended collection config with RevealUI features
 */
export interface RevealCollectionConfig extends CollectionConfig {
  hooks?: RevealCollectionHooks
}

/**
 * Extended global config with RevealUI features
 */
export interface RevealGlobalConfig extends GlobalConfig {
  hooks?: Omit<RevealCollectionHooks, 'beforeDelete' | 'afterDelete'>
}
