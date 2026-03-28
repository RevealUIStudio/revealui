/**
 * RevealUI Configuration Types
 *
 * Defines RevealUI-specific configuration interfaces that extend
 * the base CMS configuration types.
 *
 * @module @revealui/core/types/config
 */

import type { CollectionConfig, GlobalConfig, UnknownRecord } from '@revealui/contracts/cms';
import type { RevealDocument } from './query.js';
import type { RevealRequest } from './request.js';
import type { DatabaseAdapter, RevealUIInstance } from './runtime.js';
import type { RevealUser } from './user.js';

// =============================================================================
// HOOK TYPES
// =============================================================================

type RevealAfterChangeOperation = 'create' | 'update' | 'delete' | (string & {});
type RevealBeforeChangeOperation = 'create' | 'update' | (string & {});

/**
 * RevealUI's hook context
 *
 * Extends Record<string, unknown> for compatibility with base CollectionHooksConfig.
 * All fields are optional to allow compatibility with base hook types.
 */
export interface RevealHookContext extends Record<string, unknown> {
  revealui?: RevealUIInstance;
  collection?: string;
  global?: string;
  operation?: 'create' | 'read' | 'update' | 'delete';
  previousDoc?: RevealDocument;
  req?: RevealRequest;
}

/** After change hook function signature */
export type RevealAfterChangeHook<T = unknown> = (args: {
  doc: T;
  context?: RevealHookContext;
  req: RevealRequest;
  operation: RevealAfterChangeOperation;
  previousDoc?: T;
  collection?: string;
}) => Promise<T | undefined> | T | undefined;

/** Alias for global hooks */
export type GlobalAfterChangeHook<T = unknown> = RevealAfterChangeHook<T>;

/** Before change hook function signature */
export type RevealBeforeChangeHook<T = unknown> = (args: {
  data: T;
  context?: RevealHookContext;
  req: RevealRequest;
  operation: RevealBeforeChangeOperation;
  originalDoc?: T;
  collection?: string;
}) => Promise<T> | T;

/** After read hook function signature */
export type RevealAfterReadHook = (args: {
  doc: RevealDocument;
  context?: RevealHookContext;
  req: RevealRequest;
  findMany: boolean;
  query?: unknown;
}) => Promise<RevealDocument> | RevealDocument;

/** RevealUI's collection hooks - Generic to support typed hooks */
export interface RevealCollectionHooks<T = unknown> {
  beforeChange?: RevealBeforeChangeHook<T>[];
  afterChange?: RevealAfterChangeHook<T>[];
  beforeRead?: ((context: RevealHookContext) => Promise<void> | void)[];
  afterRead?: RevealAfterReadHook[];
  beforeDelete?: ((args: {
    req: RevealRequest;
    id: string | number;
    context?: RevealHookContext;
  }) => Promise<void> | void)[];
  afterDelete?: ((args: {
    doc: RevealDocument;
    id: string | number;
    req: RevealRequest;
    context?: RevealHookContext;
  }) => Promise<void> | void)[];
  afterLogin?: ((args: { req: RevealRequest; user: RevealUser }) => Promise<void> | void)[];
}

// =============================================================================
// CONFIG TYPES
// =============================================================================

/** RevealUI's main configuration */
export interface RevealConfig {
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous collection array requires type variance escape
  collections?: RevealCollectionConfig<any>[];
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous global array requires type variance escape
  globals?: RevealGlobalConfig<any>[];
  serverURL?: string;
  secret?: string;
  db?: DatabaseAdapter | null;
  admin?: {
    user?: string;
    components?: {
      beforeNavLinks?: string[];
      beforeDashboard?: string[];
      beforeLogin?: string[];
      graphics?: {
        Icon?: string;
        Logo?: string;
      };
    };
    meta?: {
      titleSuffix?: string;
      icons?: Array<{
        url: string;
        rel?: string;
        sizes?: string;
        type?: string;
      }>;
    };
    importMap?: {
      autoGenerate?: boolean;
      baseDir?: string;
    };
    livePreview?: {
      url?: (params: { data: unknown; locale?: string }) => string;
    };
  };
  onInit?: (revealui: RevealUIInstance) => Promise<void> | void;
  /** RevealUI-specific configuration options */
  revealUI?: {
    multiTenant?: boolean;
    auditLog?: boolean;
    permissions?: string[];
    theme?: string;
  };
}

/**
 * Extended collection config with RevealUI features
 *
 * Replaces base hooks with RevealUI-specific hooks for enhanced type safety.
 * Uses Omit to replace hooks property instead of intersecting it.
 *
 * Generic type T represents the document type for this collection,
 * enabling type-safe hooks that work with collection-specific types.
 */
export type RevealCollectionConfig<T = UnknownRecord> = Omit<CollectionConfig<T>, 'hooks'> & {
  hooks?: RevealCollectionHooks<T>;
};

/**
 * Extended global config with RevealUI features
 *
 * Replaces base hooks with RevealUI-specific hooks for enhanced type safety.
 * Uses Omit to replace hooks property instead of intersecting it.
 *
 * Generic type T represents the document type for this global,
 * enabling type-safe hooks that work with global-specific types.
 */
export type RevealGlobalConfig<T = UnknownRecord> = Omit<GlobalConfig, 'hooks'> & {
  hooks?: Omit<RevealCollectionHooks<T>, 'beforeDelete' | 'afterDelete'>;
};
