// Main RevealUI exports - re-export core (server) and client functionality

// Export core (server-side) functionality - now directly in root after flattening
// REST API
export { createRESTHandlers, handleRESTRequest } from './api/rest.js'
// Auth utilities
export { anyone, authenticated } from './auth/access.js'
export type {
  FloatingToolbarPluginProps,
  ImageNodeData,
  RichTextEditorProps,
  SerializedImageNode,
  ToolbarPluginProps,
} from './client/index.js'
// Export client (client-side) - but exclude RichTextEditor to avoid conflict with type
// Consumers should import RichTextEditor component from '@revealui/core/richtext-lexical/client' directly
export {
  $createImageNode,
  $isImageNode,
  // Admin
  AdminDashboard,
  APIError,
  APIErrorType,
  // Re-export admin utils
  apiClient,
  CollectionList,
  clearAuthToken,
  DocumentForm,
  FloatingToolbarPlugin,
  fetchBanner,
  fetchCard,
  fetchEvents,
  // HTTP
  fetchFromCMS,
  fetchHero,
  fetchMainInfos,
  fetchVideos,
  generatePageMetadata,
  getAuthHeader,
  getAuthToken,
  ImageNode,
  ImageNodeComponent,
  ImagePlugin,
  ImageUploadButton,
  INSERT_IMAGE_COMMAND,
  NotFoundPage,
  OPEN_IMAGE_UPLOAD_COMMAND,
  RootLayout,
  RootPage,
  // Rich text (exclude RichTextEditor component - use richtext-lexical/client)
  richTextEditorStyles,
  serializeConfig,
  setAuthToken,
  // UI
  ToolbarPlugin,
  // Hooks
  useRevealUI,
  withRevealUIAccess,
} from './client/index.js'
// Configuration
export { buildConfig } from './config/index.js'
export { getRevealUI } from './config/runtime.js'
export { deepMerge } from './config/utils.js'
// Database adapters
export { sqliteAdapter } from './database/sqlite.js'
export type { UniversalPostgresAdapterConfig } from './database/universal-postgres.js'
export { universalPostgresAdapter } from './database/universal-postgres.js'
// Factory functions
export {
  createRevealUI,
  createRevealUIAccessRule,
  createRevealUIBlock,
  createRevealUICollection,
  createRevealUIField,
} from './factories/index.js'
// Next.js integration
export { getRevealUI as getRevealUINext, withRevealUI } from './nextjs/index.js'
// Plugins
export { formBuilderPlugin } from './plugins/form-builder.js'
export { nestedDocsPlugin } from './plugins/nested-docs.js'
export { redirectsPlugin } from './plugins/redirects.js'
// Core RevealUI CMS implementation
export {
  // Field traversal utilities
  afterChangeTraverseFields,
  afterReadTraverseFields,
  beforeChangeTraverseFields,
  beforeValidateTraverseFields,
  // Query utilities
  buildWhereClause,
  // Utilities
  checkDependencies,
  // Main factory function
  createRevealUIInstance,
  defaultLogger,
  extractWhereValues,
  flattenResult,
  // Relationship utilities
  getRelationshipFields,
  // Logger
  Logger,
  // Collection and Global operations
  RevealUICollection,
  RevealUIGlobal,
  type RevealUILogger,
  // Types
  type RichTextAdapter,
  relationshipPopulationPromise,
  validateRelationshipMetadata,
  withNullableJSONSchemaType,
} from './revealui.js'
// Rich text editor
export { lexicalEditor } from './richtext/lexical.js'
// Storage adapters
export { vercelBlobStorage } from './storage/vercel-blob.js'
// Note: Logger class is exported from ./revealui.ts (instance/logger.js), not from utils/logger.js
export { LRUCache, type LRUCacheOptions } from './utils/cache.js'
// Deep clone utility
export { deepClone } from './utils/deep-clone.js'
// Error response utilities (framework-agnostic)
export {
  createApplicationErrorResponseData,
  createErrorResponseData,
  createSuccessResponseData,
  createValidationErrorResponseData,
  type ErrorResponseData,
} from './utils/error-responses.js'
export {
  ApplicationError,
  handleApiError,
  handleDatabaseError,
  ValidationError,
} from './utils/errors.js'
// Utilities
export { createLogger, type LogContext, type LogLevel, logger } from './utils/logger.js'
// Type guards
export { isJsonFieldType, isObject } from './utils/type-guards.js'

// =============================================================================
// BASE TYPES FROM SCHEMA (Single Source of Truth)
// =============================================================================
// These are the authoritative types from @revealui/contracts/cms.
// They are re-exported here for convenience.

export {
  type AccessArgs,
  // Access types
  type AccessFunction,
  type AccessResult,
  type AfterChangeHookArgs,
  type AfterReadHookArgs,
  applyPluginExtensions,
  assertValidSlug,
  type BeforeChangeHookArgs,
  type CollectionAccessConfig,
  // Hook types (TypeScript contracts)
  type CollectionAfterChangeHook,
  type CollectionAfterReadHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
  type CollectionHooksConfig,
  type Config,
  // Validation utilities
  ConfigValidationError,
  // Config helpers
  defineCollection,
  defineField,
  defineGlobal,
  // Core field and collection types
  type Field,
  type FieldAccessConfig,
  type FieldValidateArgs,
  // Validation types
  type FieldValidateFunction,
  fromCMSCollectionConfig,
  fromCMSGlobalConfig,
  type GlobalAccessConfig,
  type GlobalConfig,
  type GlobalHooksConfig,
  getCustomFieldType,
  getRevealUIExtensions,
  // RevealUI extensions
  hasRevealUIExtensions,
  isValidFieldType,
  isValidSlug,
  mergeCollectionConfigs,
  mergeFields,
  // Extensibility
  registerCustomFieldType,
  registerPluginExtension,
  type SanitizedCollectionConfig,
  type SanitizedConfig,
  type SanitizedGlobalConfig,
  safeValidate,
  // CMS compatibility
  toCMSCollectionConfig,
  toCMSGlobalConfig,
  toSlug,
  validateWithErrors,
  type Where,
} from '@revealui/contracts/cms'

// =============================================================================
// REVEALUI-SPECIFIC TYPES
// =============================================================================
// These extend the base types with RevealUI framework features.

export type {
  // Block types
  Block,
  BlocksField,
  CheckboxField,
  DatabaseAdapter,
  // Database/Storage
  DatabaseResult,
  FindArgs,
  JsonObject,
  OperationOptions,
  PaginatedDocs,
  Permission,
  // Plugins
  Plugin,
  PluginOptions,
  PopulateType,
  RequestContext,
  // RevealUI hook types
  RevealAfterChangeHook,
  RevealAfterReadHook,
  RevealBeforeChangeHook,
  RevealCollection,
  // RevealUI extended configs
  RevealCollectionConfig,
  RevealCollectionHooks,
  RevealConfig,
  RevealCreateOptions,
  RevealDataObject,
  RevealDeleteOptions,
  // RevealUI document types
  RevealDocument,
  RevealDocumentWithMeta,
  RevealFindOptions,
  RevealGlobal,
  RevealGlobalConfig,
  RevealHookContext,
  // RevealUI query system
  RevealOperator,
  RevealPaginatedResult,
  // RevealUI request/context
  RevealRequest,
  RevealSelect,
  RevealSort,
  RevealUIAccessContext,
  RevealUIAccessResult,
  RevealUIAccessRule,
  RevealUICollectionConfig,
  // RevealUI framework extensions
  RevealUIContext,
  RevealUIEnhancedField,
  RevealUIField,
  RevealUIFieldHook,
  RevealUIFieldType,
  RevealUIFieldValidator,
  RevealUIFilterResult,
  RevealUIFrameworkContext,
  // RevealUI hooks
  RevealUIHookContext,
  // RevealUI runtime
  RevealUIInstance,
  RevealUIPermission,
  RevealUITenant,
  RevealUIUser,
  RevealUIValidationRule,
  RevealUpdateOptions,
  // RevealUI user types
  RevealUser,
  RevealValue,
  RevealWhere,
  RichTextEditor,
  // Rich text
  RichTextFeature,
  SelectType,
  StorageAdapter,
  TypeWithID,
  WhereClause,
} from './types/index.js'

// =============================================================================
// ADDITIONAL TYPE EXPORTS
// =============================================================================

export type {
  // Additional framework types
  Access,
  // Field types from schema
  ArrayField,
  AuthConfig,
  ClientCollectionConfig,
  // Internal types (for advanced usage)
  ClientConfig,
  CollectionAccess,
  CollectionAdminConfig,
  CollectionLabels,
  // Component types
  CustomComponent,
  // Extensibility
  CustomFieldTypeConfig,
  Document,
  EndpointHandler,
  EndpointHandlerArgs,
  FieldAccess,
  FieldAccessConfig as SchemaFieldAccessConfig,
  FieldAdminConfig,
  FieldHooksConfig,
  FieldOption,
  // Schema exports
  FieldType,
  GlobalAccess,
  GlobalAdminConfig,
  GlobalLabels,
  GlobalVersionsConfig,
  GroupField,
  PluginFieldExtension,
  // Handler types
  RevealHandler,
  RevealUIAccessArgs,
  // Block type
  RevealUIBlock,
  RevealUIComponent,
  RevealUIDependencyCheckArgs,
  RevealUIExtensions,
  RevealUIRichTextAdapter,
  RevealUISchemaArgs,
  RevealUITraverseFieldsArgs,
  RevealUITraverseFieldsResult,
  SelectMode,
  TabDefinition,
  TextField,
  // Locale/mode types
  TypedFallbackLocale,
  UploadConfig,
  // Validation
  ValidationResult,
  VersionsConfig,
} from './types/index.js'

// =============================================================================
// TYPE DOCUMENTATION
// =============================================================================
/**
 * ## Import Guide
 *
 * ### Base Types (from schema - single source of truth)
 * For standard RevealUI CMS types that work everywhere:
 * ```typescript
 * import { CollectionConfig, GlobalConfig, Field } from '@revealui/core'
 * // OR directly from schema:
 * import { CollectionConfig, GlobalConfig, Field } from '@revealui/contracts/cms'
 * ```
 *
 * ### Extended Types (RevealUI-specific)
 * For RevealUI framework features (tenants, permissions, etc.):
 * ```typescript
 * import { RevealCollectionConfig, RevealGlobalConfig } from '@revealui/core'
 * ```
 *
 * ### Helper Functions
 * For typed config creation:
 * ```typescript
 * import { defineCollection, defineGlobal, defineField } from '@revealui/core'
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
 * import { validateWithErrors, ConfigValidationError } from '@revealui/core'
 * ```
 */
