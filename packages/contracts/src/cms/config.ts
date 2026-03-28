/**
 * Combined Configuration Types
 *
 * These types combine Zod-validated structure with TypeScript function contracts.
 *
 * Structure (validated by Zod at runtime):
 * - Field names, types, constraints
 * - Admin configuration
 * - Labels, slugs
 *
 * Functions (enforced by TypeScript at compile time):
 * - Access functions
 * - Hook functions
 * - Validation functions
 * - Condition functions
 *
 * @module @revealui/contracts/core/contracts/config
 */

import type {
  AccessFunction,
  CollectionAccessConfig,
  CollectionHooksConfig,
  ConditionFunction,
  EndpointConfig,
  FieldAccessConfig,
  FieldHooksConfig,
  FieldValidateArgs,
  FilterOptionsFunction,
  GlobalAccessConfig,
  GlobalHooksConfig,
} from './functions.js';
import type { CollectionStructure, FieldStructure, GlobalStructure } from './structure.js';

export type UnknownRecord = Record<string, unknown>;
type HookFn = (args: UnknownRecord) => unknown;
type FieldBeforeReadHook = HookFn;
type LooseFieldAccessConfig = FieldAccessConfig<UnknownRecord, UnknownRecord>;
type LooseFieldHooksConfig = FieldHooksConfig<unknown, UnknownRecord, UnknownRecord> & {
  beforeRead?: FieldBeforeReadHook[];
};
type LooseCollectionAccessConfig<T = UnknownRecord> = CollectionAccessConfig<T> & {
  readVersions?: AccessFunction<T>;
};
type LooseCollectionHooksConfig<T = UnknownRecord> = CollectionHooksConfig<T> & {
  afterLogin?: HookFn[];
  afterLogout?: HookFn[];
  afterRefresh?: HookFn[];
  afterMe?: HookFn[];
  afterForgotPassword?: HookFn[];
};
type LooseGlobalHooksConfig = GlobalHooksConfig<UnknownRecord> & {
  beforeValidate?: HookFn[];
};
type LooseFieldValidateArgs = FieldValidateArgs<unknown, UnknownRecord, UnknownRecord>;
type LooseGlobalAccessConfig = GlobalAccessConfig & {
  readVersions?: AccessFunction<UnknownRecord>;
};

// ============================================
// FIELD TYPE
// ============================================

/**
 * Complete Field type combining structure and functions
 *
 * This is a simplified, non-generic Field type that works with any document type.
 * For typed field definitions, use the TypeScript helper `defineField<T>()`.
 *
 * @example
 * ```typescript
 * // Basic text field
 * const titleField: Field = {
 *   name: 'title',
 *   type: 'text',
 *   required: true,
 * };
 *
 * // Field with hooks
 * const slugField: Field = {
 *   name: 'slug',
 *   type: 'text',
 *   hooks: {
 *     beforeChange: [({ value, siblingData }) => {
 *       return value || String(siblingData?.title)?.toLowerCase().replace(/\s+/g, '-');
 *     }],
 *   },
 * };
 * ```
 */
export interface Field extends Omit<FieldStructure, 'fields' | 'blocks' | 'tabs'> {
  // Function properties - using loose types for compatibility with destructured params
  access?: LooseFieldAccessConfig;
  hooks?: LooseFieldHooksConfig;
  validate?: (
    value: unknown,
    args: LooseFieldValidateArgs,
  ) => string | true | Promise<string | true>;
  condition?: ConditionFunction<UnknownRecord, UnknownRecord>;
  filterOptions?: FilterOptionsFunction<UnknownRecord>;

  // Nested fields (recursive)
  fields?: Field[];

  // Blocks (for blocks field) - allow any shape
  blocks?: unknown[];

  // Tabs (for tabs field)
  tabs?: Array<{
    label: string;
    name?: string;
    description?: string;
    fields: Field[];
    custom?: Record<string, unknown>;
  }>;

  // Editor (for richText field) - function type
  editor?: unknown;

  // Custom properties for extensibility (without breaking type inference)
  custom?: Record<string, unknown>;
}

// ============================================
// COLLECTION CONFIG TYPE
// ============================================

/**
 * Complete CollectionConfig type combining structure and functions
 *
 * Generic over the document type to provide proper type inference for hooks and access functions.
 * Defaults to UnknownRecord for backward compatibility.
 *
 * @template T - The document type for this collection (defaults to UnknownRecord)
 *
 * @example
 * ```typescript
 * // Without type parameter (backward compatible)
 * const Posts: CollectionConfig = {
 *   slug: 'posts',
 *   fields: [
 *     { name: 'title', type: 'text', required: true },
 *     { name: 'slug', type: 'text', required: true },
 *   ],
 *   access: {
 *     read: () => true,
 *     create: ({ req }) => Boolean(req.user),
 *   },
 *   hooks: {
 *     afterChange: [({ doc }) => {
 *       // Log the update
 *       return doc;
 *     }],
 *   },
 * };
 *
 * // With type parameter (typed hooks and access functions)
 * interface Post {
 *   id: string;
 *   title: string;
 *   slug: string;
 * }
 *
 * const Posts: CollectionConfig<Post> = {
 *   slug: 'posts',
 *   fields: [...],
 *   hooks: {
 *     afterChange: [({ doc }) => {
 *       // doc is properly typed as Post
 *       return doc;
 *     }],
 *   },
 * };
 * ```
 */
export interface CollectionConfig<T = UnknownRecord> extends Omit<CollectionStructure, 'fields'> {
  // Schema version
  schemaVersion?: number;
  // Fields with function support
  fields: Field[];

  // Access functions - typed for the document type T
  // Functions can have any signature as long as they return boolean or Where clause
  access?: LooseCollectionAccessConfig<T>;

  // Hooks - typed for the document type T
  // Hook functions can destructure their arguments freely
  hooks?: LooseCollectionHooksConfig<T>;

  /** Allow unauthenticated read access for published content. Default: false. */
  publicRead?: boolean;

  endpoints?: EndpointConfig[] | false;

  // Custom properties for extensibility (without breaking type inference)
  custom?: Record<string, unknown>;
}

// ============================================
// GLOBAL CONFIG TYPE
// ============================================

/**
 * Complete GlobalConfig type combining structure and functions
 *
 * This is a simplified, non-generic GlobalConfig type that works with any document.
 * For typed global definitions, use the TypeScript helper `defineGlobal<T>()`.
 *
 * @example
 * ```typescript
 * const Settings: GlobalConfig = {
 *   slug: 'settings',
 *   fields: [
 *     { name: 'siteName', type: 'text', required: true },
 *     { name: 'siteDescription', type: 'textarea' },
 *   ],
 *   access: {
 *     read: () => true,
 *     update: ({ req }) => Boolean(req.user),
 *   },
 * };
 * ```
 */
export interface GlobalConfig extends Omit<GlobalStructure, 'fields'> {
  // Schema version
  schemaVersion?: number;
  // Fields with function support
  fields: Field[];

  // Access functions - using loose types for compatibility with destructured params
  access?: LooseGlobalAccessConfig;

  // Hooks - using loose types for compatibility with destructured params
  hooks?: LooseGlobalHooksConfig;

  endpoints?: EndpointConfig[] | false;

  // Custom properties for extensibility (without breaking type inference)
  custom?: Record<string, unknown>;
}

// ============================================
// CONFIG TYPE (Full CMS Config)
// ============================================

/**
 * Database adapter configuration (simplified)
 */
export interface DatabaseAdapterConfig {
  pool?: unknown;
  idType?: 'serial' | 'uuid';
  custom?: Record<string, unknown>;
}

/**
 * Email configuration
 */
export interface EmailConfig {
  transportOptions?: unknown;
  fromName?: string;
  fromAddress?: string;
  custom?: Record<string, unknown>;
}

/**
 * Admin panel configuration
 */
export interface AdminConfig {
  user?: string;
  meta?: {
    titleSuffix?: string;
    ogImage?: string;
    favicon?: string;
    // Icons for various platforms
    icons?: Array<{
      url?: string;
      sizes?: string;
      type?: string;
      rel?: string;
      fetchPriority?: 'high' | 'low' | 'auto';
    }>;
  };
  importMap?: {
    autoGenerate?: boolean;
    baseDir?: string;
    custom?: Record<string, unknown>;
  };
  components?: unknown;
  css?: string;
  scss?: string;
  dateFormat?: string;
  avatar?: string;
  disable?: boolean;
  livePreview?: {
    url?: string | ((args: { data: unknown; locale?: string }) => string);
    collections?: string[];
    globals?: string[];
    breakpoints?: Array<{
      label: string;
      name: string;
      width: number;
      height: number;
    }>;
    custom?: Record<string, unknown>;
  };
  custom?: Record<string, unknown>;
}

/**
 * Localization configuration
 */
export interface LocalizationConfig {
  locales: string[] | Array<{ label: string; code: string }>;
  defaultLocale: string;
  fallback?: boolean;
}

/**
 * Complete RevealUI Config type
 *
 * This is the root configuration passed to buildConfig()
 */
export interface Config {
  // Required
  secret: string;

  // Collections and globals
  // biome-ignore lint/suspicious/noExplicitAny: invariant generic requires any for heterogeneous collections
  collections?: CollectionConfig<any>[];
  globals?: GlobalConfig[];

  // Database - allow adapter-specific shape
  db?: unknown;

  // Server
  serverURL?: string;

  // Admin
  admin?: AdminConfig;

  // Email
  email?: EmailConfig;

  // Localization
  localization?: LocalizationConfig | false;

  // i18n (internationalization)
  i18n?: {
    locales?: string[];
    defaultLocale?: string;
    fallback?: boolean;
    supportedLanguages?: Record<string, unknown>;
  };

  // CORS
  cors?: string | string[] | { origins: string[]; headers?: string[] };

  // CSRF
  csrf?: string[];

  // Rate limiting
  rateLimit?: {
    window?: number;
    max?: number;
    trustProxy?: boolean;
    skip?: (req: unknown) => boolean;
  };

  // Uploads
  upload?: {
    limits?: {
      fileSize?: number;
    };
  };

  // Debug
  debug?: boolean;

  // TypeScript
  typescript?: {
    outputFile?: string;
    declare?: boolean;
    autoGenerate?: boolean;
  };

  // Telemetry
  telemetry?: boolean;

  // Hooks
  hooks?: {
    afterError?: Array<(args: { error: Error; context: unknown }) => void | Promise<void>>;
  };

  // onInit callback - allow custom return
  onInit?: (revealui: unknown) => unknown;

  // Plugins - allow custom plugin shapes
  plugins?: unknown[];

  // Editor - lexical, slate, or custom editor configuration
  editor?: unknown;

  // Sharp - image processing library configuration
  sharp?: unknown;

  // Custom properties for extensibility
  custom?: Record<string, unknown>;
}

/**
 * Sanitized config (after RevealUI processes it)
 * This is what's available at runtime
 */
export interface SanitizedConfig extends Config {
  // biome-ignore lint/suspicious/noExplicitAny: invariant generic requires any for heterogeneous collections
  collections: CollectionConfig<any>[];
  globals: GlobalConfig[];
}

// ============================================
// TYPE HELPERS
// ============================================

/**
 * Typed collection config for advanced type inference
 * Use this when you need TypeScript to know the document type
 */
export interface TypedCollectionConfig<T> extends CollectionConfig {
  // This is a marker interface for typed configs
  __docType?: T;
}

/**
 * Typed global config for advanced type inference
 * Use this when you need TypeScript to know the document type
 */
export interface TypedGlobalConfig<T> extends GlobalConfig {
  // This is a marker interface for typed configs
  __docType?: T;
}

/**
 * Helper to create a typed collection config
 *
 * @example
 * ```typescript
 * interface Post {
 *   id: string;
 *   title: string;
 * }
 *
 * const Posts = defineCollection<Post>({
 *   slug: 'posts',
 *   fields: [{ name: 'title', type: 'text' }],
 * });
 * ```
 */
export function defineCollection<T = unknown>(config: CollectionConfig): TypedCollectionConfig<T> {
  return config as TypedCollectionConfig<T>;
}

/**
 * Helper to create a typed global config
 */
export function defineGlobal<T = unknown>(config: GlobalConfig): TypedGlobalConfig<T> {
  return config as TypedGlobalConfig<T>;
}

/**
 * Helper to create a field
 */
export function defineField(field: Field): Field {
  return field;
}
