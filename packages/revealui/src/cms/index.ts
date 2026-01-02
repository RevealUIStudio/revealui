// RevealUI CMS - Core functionality

// Admin utilities
export { en } from './admin/i18n/en'

// Framework API (RevealUI class and factory functions)
export {
  RevealUI,
  createRevealUI,
  createRevealUICollection,
  createRevealUIField,
  createRevealUIBlock,
  createRevealUIAccessRule,
  useRevealUI,
  withRevealUIAccess,
} from './api'

// Core RevealUI CMS implementation
export {
  // Main factory function
  createRevealUIInstance,
  // Field traversal utilities
  afterChangeTraverseFields,
  afterReadTraverseFields,
  beforeChangeTraverseFields,
  beforeValidateTraverseFields,
  // Utilities
  checkDependencies,
  deepMergeSimple,
  flattenResult,
  withNullableJSONSchemaType,
  // Types
  type RichTextAdapter,
} from './core/revealui'

// REST API
export { createRESTHandlers, handleRESTRequest } from './api/rest'

// Auth utilities
export { anyone, authenticated } from './auth/access'

// Configuration
export { buildConfig } from './config/index.js'
export { getRevealUI } from './config/runtime.js'
export { deepMerge } from './config/utils'
export { postgresAdapter } from './database/postgres'
// Database adapters
export { sqliteAdapter } from './database/sqlite'
// Next.js integration
export { getRevealUI as getRevealUINext, withRevealUI } from './nextjs/index'
// Plugins
export { formBuilderPlugin } from './plugins/form-builder'
export { nestedDocsPlugin } from './plugins/nested-docs'
export { redirectsPlugin } from './plugins/redirects'
// Rich text editor
export { lexicalEditor } from './richtext/lexical'
// Storage adapters
export { vercelBlobStorage } from './storage/vercel-blob'

// =============================================================================
// BASE TYPES FROM SCHEMA (Single Source of Truth)
// =============================================================================
// These are the authoritative types from @revealui/schema/cms.
// They are re-exported here for convenience.

export {
  // Core field and collection types
  type Field,
  type CollectionConfig,
  type GlobalConfig,
  type Config,
  type SanitizedConfig,
  type SanitizedCollectionConfig,
  type SanitizedGlobalConfig,
  // Hook types (TypeScript contracts)
  type CollectionAfterChangeHook,
  type CollectionAfterReadHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeValidateHook,
  type CollectionHooksConfig,
  type GlobalHooksConfig,
  type BeforeChangeHookArgs,
  type AfterChangeHookArgs,
  type AfterReadHookArgs,
  // Access types
  type AccessFunction,
  type AccessResult,
  type AccessArgs,
  type CollectionAccessConfig,
  type FieldAccessConfig,
  type GlobalAccessConfig,
  type Where,
  // Validation types
  type FieldValidateFunction,
  type FieldValidateArgs,
  // Config helpers
  defineCollection,
  defineGlobal,
  defineField,
  // Extensibility
  registerCustomFieldType,
  getCustomFieldType,
  isValidFieldType,
  registerPluginExtension,
  applyPluginExtensions,
  mergeFields,
  mergeCollectionConfigs,
  // Validation utilities
  ConfigValidationError,
  validateWithErrors,
  safeValidate,
  // CMS compatibility
  toCMSCollectionConfig,
  toCMSGlobalConfig,
  fromCMSCollectionConfig,
  fromCMSGlobalConfig,
  // RevealUI extensions
  hasRevealUIExtensions,
  getRevealUIExtensions,
  isValidSlug,
  toSlug,
  assertValidSlug,
} from '@revealui/schema/cms'

// =============================================================================
// REVEALUI-SPECIFIC TYPES
// =============================================================================
// These extend the base types with RevealUI framework features.

export type {
  // RevealUI extended configs
  RevealCollectionConfig,
  RevealGlobalConfig,
  RevealConfig,
  RevealCollectionHooks,
  // RevealUI hook types
  RevealAfterChangeHook,
  RevealBeforeChangeHook,
  RevealAfterReadHook,
  RevealHookContext,
  // RevealUI query system
  RevealOperator,
  RevealValue,
  RevealDataObject,
  RevealWhere,
  RevealSort,
  RevealSelect,
  // RevealUI document types
  RevealDocument,
  RevealDocumentWithMeta,
  // RevealUI user types
  RevealUser,
  RevealUIUser,
  RevealUITenant,
  // RevealUI request/context
  RevealRequest,
  RequestContext,
  // RevealUI runtime
  RevealUIInstance,
  // Note: RevealUI class is exported from './api', type alias skipped to avoid conflict
  RevealCollection,
  RevealGlobal,
  RevealUILogger,
  RevealFindOptions,
  RevealCreateOptions,
  RevealUpdateOptions,
  RevealDeleteOptions,
  RevealPaginatedResult,
  // RevealUI framework extensions
  RevealUIContext,
  RevealUIFrameworkContext,
  RevealUICollectionConfig,
  RevealUIField,
  RevealUIEnhancedField,
  RevealUIFieldType,
  RevealUIAccessResult,
  RevealUIAccessContext,
  RevealUIAccessRule,
  RevealUIFilterResult,
  RevealUIPermission,
  // RevealUI hooks
  RevealUIHookContext,
  RevealUIFieldHook,
  RevealUIValidationRule,
  RevealUIFieldValidator,
  // Database/Storage
  DatabaseResult,
  DatabaseAdapter,
  StorageAdapter,
  // Rich text
  RichTextFeature,
  RichTextEditor,
  // Plugins
  Plugin,
  PluginOptions,
  // Block types
  Block,
  CheckboxField,
  BlocksField,
  PaginatedDocs,
  TypeWithID,
  PopulateType,
  SelectType,
  JsonObject,
  WhereClause,
  FindArgs,
  OperationOptions,
  Permission,
} from './types/index'

// =============================================================================
// ADDITIONAL TYPE EXPORTS
// =============================================================================

export type {
  // Field types from schema
  ArrayField,
  GroupField,
  TextField,
  UploadConfig,
  AuthConfig,
  VersionsConfig,
  // Additional framework types
  Access,
  RevealUIAccessArgs,
  FieldAccess,
  // Schema exports
  FieldType,
  FieldAdminConfig,
  FieldAccessConfig as SchemaFieldAccessConfig,
  FieldHooksConfig,
  FieldOption,
  TabDefinition,
  CollectionLabels,
  CollectionAccess,
  CollectionAdminConfig,
  GlobalLabels,
  GlobalAccess,
  GlobalAdminConfig,
  GlobalVersionsConfig,
  // Extensibility
  CustomFieldTypeConfig,
  PluginFieldExtension,
  RevealUIExtensions,
  // Validation
  ValidationResult,
  // Component types
  CustomComponent,
  RevealUIComponent,
  // Handler types
  RevealHandler,
  EndpointHandler,
  EndpointHandlerArgs,
  // Locale/mode types
  TypedFallbackLocale,
  SelectMode,
  Document,
  // Block type
  RevealUIBlock,
  // Internal types (for advanced usage)
  ClientConfig,
  ClientCollectionConfig,
  RevealUITraverseFieldsArgs,
  RevealUITraverseFieldsResult,
  RevealUIDependencyCheckArgs,
  RevealUISchemaArgs,
  RevealUIRichTextAdapter,
} from './types/index'

// Utility exports
export { getRelationshipFields, validateRelationshipMetadata } from './utils/relationshipAnalyzer'

// =============================================================================
// TYPE DOCUMENTATION
// =============================================================================
/**
 * ## Import Guide
 *
 * ### Base Types (from schema - single source of truth)
 * For standard RevealUI CMS types that work everywhere:
 * ```typescript
 * import { CollectionConfig, GlobalConfig, Field } from '@revealui/cms'
 * // OR directly from schema:
 * import { CollectionConfig, GlobalConfig, Field } from '@revealui/schema/cms'
 * ```
 *
 * ### Extended Types (RevealUI-specific)
 * For RevealUI framework features (tenants, permissions, etc.):
 * ```typescript
 * import { RevealCollectionConfig, RevealGlobalConfig } from '@revealui/cms'
 * ```
 *
 * ### Helper Functions
 * For typed config creation:
 * ```typescript
 * import { defineCollection, defineGlobal, defineField } from '@revealui/cms'
 *
 * const Posts = defineCollection<Post>({
 *   slug: 'posts',
 *   fields: [...]
 * })
 * ```
 *
 * ### Validation
 * For runtime config validation:
 * ```typescript
 * import { validateWithErrors, ConfigValidationError } from '@revealui/cms'
 * ```
 */
