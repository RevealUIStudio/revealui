/**
 * Main RevealUI exports — re-exports core (server) and client functionality.
 *
 * WARNING: Importing from '@revealui/core' pulls in BOTH server-only deps (pg,
 * bcryptjs, PGlite) and client-side React code. For tree-shaking safety, prefer
 * specific subpath imports:
 *   - '@revealui/core/client' for client-only code
 *   - '@revealui/core/server' for server-only code
 *   - '@revealui/core/database' for the DB adapter
 *   - '@revealui/core/richtext/client' for the rich text editor
 */

// Export core (server-side) functionality - now directly in root after flattening
// REST API
export { createRESTHandlers, handleRESTRequest } from './api/rest.js';
// Auth utilities
export { anyone, authenticated } from './auth/access.js';
export type {
  FloatingToolbarPluginProps,
  ImageNodeData,
  RichTextEditorProps,
  SerializedImageNode,
  ToolbarPluginProps,
} from './client/index.js';
// Export client (client-side) - but exclude RichTextEditor to avoid conflict with type
// Consumers should import RichTextEditor component from '@revealui/core/richtext/client' directly
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
  DocumentForm,
  FloatingToolbarPlugin,
  generatePageMetadata,
  ImageNode,
  ImageNodeComponent,
  ImagePlugin,
  ImageUploadButton,
  INSERT_IMAGE_COMMAND,
  NotFoundPage,
  OPEN_IMAGE_UPLOAD_COMMAND,
  RootLayout,
  RootPage,
  // Rich text (exclude RichTextEditor component - use richtext/client)
  richTextEditorStyles,
  serializeConfig,
  // UI
  ToolbarPlugin,
  // Hooks
  useRevealUI,
  withRevealUIAccess,
} from './client/index.js';
// Configuration
export { buildConfig } from './config/index.js';
export { getRevealUI } from './config/runtime.js';
export { deepMerge } from './config/utils.js';
// Database adapters (PGlite/PostgreSQL only - SQLite support removed)
export type { UniversalPostgresAdapterConfig } from './database/universal-postgres.js';
export { universalPostgresAdapter } from './database/universal-postgres.js';
// Factory functions
export {
  createRevealUI,
  createRevealUIAccessRule,
  createRevealUIBlock,
  createRevealUICollection,
  createRevealUIField,
} from './factories/index.js';
export {
  type FeatureFlags,
  getFeatures,
  getFeaturesForTier,
  getRequiredTier,
  isFeatureEnabled,
} from './features.js';
// License and feature flags
export {
  computeKeyId,
  configureLicenseCache,
  generateLicenseKey,
  getCurrentTier,
  getLicensePayload,
  getMaxSites,
  getMaxUsers,
  initializeLicense,
  isLicensed,
  type LicenseCacheConfig,
  type LicensePayload,
  type LicenseTier,
  resetLicenseState,
  validateLicenseKey,
} from './license.js';
// Next.js integration
export {
  getRevealUI as getRevealUINext,
  withRevealUI,
} from './nextjs/index.js';
// Plugins
export { formBuilderPlugin } from './plugins/form-builder.js';
export { nestedDocsPlugin } from './plugins/nested-docs.js';
export { redirectsPlugin } from './plugins/redirects.js';
// Core RevealUI admin implementation
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
} from './revealui.js';
// Rich text editor
export {
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  ItalicFeature,
  LinkFeature,
  lexicalEditor,
  TreeViewFeature,
  UnderlineFeature,
} from './richtext/index.js';
// Storage adapters
export { vercelBlobStorage } from './storage/vercel-blob.js';
// Note: Logger class is exported from ./revealui.ts (instance/logger.js), not from utils/logger.js
export { LRUCache, type LRUCacheOptions } from './utils/cache.js';
// Deep clone utility
export { deepClone } from './utils/deep-clone.js';
// Error response utilities (framework-agnostic)
export {
  createApplicationErrorResponseData,
  createErrorResponseData,
  createSuccessResponseData,
  createValidationErrorResponseData,
  type ErrorResponseData,
} from './utils/error-responses.js';
export {
  ApplicationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  handleApiError,
  handleDatabaseError,
  NotFoundError,
  PostgresErrorCode,
  RateLimitError,
  ValidationError,
} from './utils/errors.js';
// Utilities
export {
  createLogger,
  type LogContext,
  type LogLevel,
  logger,
} from './utils/logger.js';
// Type guards
export { flattenFields, isJsonFieldType, isObject } from './utils/type-guards.js';

// =============================================================================
// BASE TYPES FROM SCHEMA (Single Source of Truth)
// =============================================================================
// These are the authoritative types from @revealui/contracts/admin.
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
  // type FieldValidateFunction,
  fromAdminCollectionConfig,
  fromAdminGlobalConfig,
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
  // admin compatibility
  toAdminCollectionConfig,
  toAdminGlobalConfig,
  toSlug,
  validateWithErrors,
  type Where,
} from '@revealui/contracts/admin';

// =============================================================================
// REVEALUI-SPECIFIC TYPES
// =============================================================================
// These extend the base types with RevealUI framework features.

export type {
  BatchCreateOptions,
  BatchDeleteOptions,
  BatchResult,
  BatchUpdateOptions,
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
  RevealUI,
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
} from './types/index.js';

// =============================================================================
// ADDITIONAL TYPE EXPORTS
// =============================================================================

export { serializeLexicalState } from './richtext/index.js';
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
  FieldAccessArgs,
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
  VersionConfig,
} from './types/index.js';

// =============================================================================
// TYPE DOCUMENTATION
// =============================================================================
/**
 * ## Import Guide
 *
 * ### Base Types (from schema - single source of truth)
 * For standard RevealUI admin types that work everywhere:
 * ```typescript
 * import { CollectionConfig, GlobalConfig, Field } from '@revealui/core'
 * // OR directly from schema:
 * import { CollectionConfig, GlobalConfig, Field } from '@revealui/contracts/admin'
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
