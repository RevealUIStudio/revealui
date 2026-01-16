/**
 * RevealUI CMS Framework - Type System
 *
 * This module consolidates the CMS type system using @revealui/schema contracts
 * as the single source of truth, while extending with RevealUI-specific features.
 *
 * ## Architecture
 *
 * 1. **Schema Contracts** (@revealui/schema/core)
 *    - Core field, collection, and global schemas
 *    - Runtime validation with Zod
 *    - Type inference from schemas
 *    - Function contracts (hooks, access, validation)
 *
 * 2. **RevealUI Types** (this package)
 *    - Query system (RevealWhere, RevealOperators)
 *    - Runtime system (RevealUIInstance, RevealFindOptions)
 *    - User system (RevealUser, RevealUIUser)
 *    - Framework extensions (tenants, permissions)
 *
 * @packageDocumentation
 */

// =============================================================================
// SCHEMA CONTRACT EXPORTS
// =============================================================================
// All types from the schema contracts layer

export {
  type AccessArgs,
  // Function contracts (TypeScript - compile time)
  type AccessFunction,
  type AccessResult,
  type AfterChangeHookArgs,
  type AfterReadHookArgs,
  type ArrayField,
  ArrayFieldSchema,
  type AuthConfig,
  AuthConfigSchema,
  applyPluginExtensions,
  assertValidSlug,
  type BeforeChangeHookArgs,
  // Collection contracts
  COLLECTION_SCHEMA_VERSION,
  type CollectionAccess,
  type CollectionAccessConfig,
  CollectionAccessSchema,
  type CollectionAdminConfig,
  CollectionAdminConfigSchema,
  type CollectionAfterChangeHook,
  type CollectionAfterReadHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeReadHook,
  // Hook type contracts
  type CollectionBeforeValidateHook,
  type CollectionConfig,
  CollectionConfigSchema,
  type CollectionHooks,
  type CollectionHooksConfig,
  CollectionHooksSchema,
  type CollectionLabels,
  CollectionLabelsSchema,
  type CollectionStructure,
  CollectionStructureSchema,
  type Config,
  // ==========================================================================
  // HYBRID CONTRACTS
  // ==========================================================================
  // Error handling
  ConfigValidationError,
  type CustomFieldTypeConfig,
  createAuthCollectionConfig,
  // Collection factories
  createCollectionConfig,
  // Global factories
  createGlobalConfig,
  createUploadCollectionConfig,
  // Config helpers
  defineCollection,
  defineField,
  defineGlobal,
  ExtendedFieldTypeSchema,
  // Field contracts
  FIELD_SCHEMA_VERSION,
  type Field,
  type FieldAccess as SchemaFieldAccess,
  type FieldAccessConfig,
  FieldAccessConfigSchema,
  type FieldAccessFunction,
  type FieldAdminConfig,
  FieldAdminConfigSchema,
  type FieldHooksConfig,
  FieldHooksConfigSchema,
  type FieldOption,
  FieldOptionSchema,
  FieldSchema,
  type FieldStructure,
  // Structure schemas (Zod - runtime validation)
  FieldStructureSchema,
  // Field types
  type FieldType,
  FieldTypeSchema,
  type FieldValidateArgs,
  // Validation contracts
  type FieldValidateFunction,
  fromCMSCollectionConfig,
  fromCMSGlobalConfig,
  // Global contracts
  GLOBAL_SCHEMA_VERSION,
  type GlobalAccess,
  type GlobalAccessConfig,
  GlobalAccessSchema,
  type GlobalAdminConfig,
  GlobalAdminConfigSchema,
  type GlobalConfig,
  GlobalConfigSchema,
  type GlobalHooks,
  type GlobalHooksConfig,
  GlobalHooksSchema,
  type GlobalLabels,
  GlobalLabelsSchema,
  type GlobalStructure,
  GlobalStructureSchema,
  type GlobalVersionsConfig,
  GlobalVersionsConfigSchema,
  type GroupField,
  GroupFieldSchema,
  getCustomFieldType,
  getRevealUIExtensions,
  hasNestedFields,
  // RevealUI extensions
  hasRevealUIExtensions,
  isArrayField,
  isGroupField,
  isLayoutField,
  isNumberField,
  isRelationshipField,
  // Field type guards
  isTextField,
  isValidFieldType,
  isValidSlug,
  mergeCollectionConfigs,
  mergeFields,
  type NumberField,
  NumberFieldSchema,
  type PluginFieldExtension,
  type RelationshipField,
  RelationshipFieldSchema,
  type RevealUICollectionConfig as SchemaRevealUICollectionConfig,
  type RevealUIExtensions,
  type RevealUIGlobalConfig as SchemaRevealUIGlobalConfig,
  type RowField,
  RowFieldSchema,
  // Extensibility
  registerCustomFieldType,
  registerPluginExtension,
  type SanitizedCollectionConfig,
  SanitizedCollectionConfigSchema,
  type SanitizedConfig,
  type SanitizedGlobalConfig,
  SanitizedGlobalConfigSchema,
  type SelectField,
  SelectFieldSchema,
  safeValidate,
  type TabDefinition,
  TabDefinitionSchema,
  type TabsField,
  TabsFieldSchema,
  type TextField,
  TextFieldSchema,
  // CMS compatibility
  toCMSCollectionConfig,
  toCMSGlobalConfig,
  toSlug,
  type UploadConfig,
  UploadConfigSchema,
  type ValidationResult,
  type VersionsConfig,
  VersionsConfigSchema,
  validateWithErrors,
  type Where,
  // Zod for runtime validation
  z,
} from '@revealui/schema/core'

// =============================================================================
// QUERY TYPES
// =============================================================================

export {
  type Document,
  type JsonObject,
  type PopulateType,
  type RelationshipMetadata,
  type RevealDataObject,
  type RevealDocument,
  type RevealDocumentWithMeta,
  type RevealOperator,
  RevealOperators,
  type RevealSelect,
  type RevealSort,
  type RevealValue,
  type RevealWhere,
  type RevealWhereField,
  type SelectMode,
  type SelectType,
  // New exports
  type TypedFallbackLocale,
  type TypeWithID,
  type WhereClause,
} from './query.js'

// =============================================================================
// USER TYPES
// =============================================================================

export type {
  Permission,
  RevealUIPermission,
  RevealUITenant,
  RevealUIUser,
  RevealUser,
  User,
} from './user.js'

// =============================================================================
// REQUEST TYPES
// =============================================================================

export type {
  RequestContext,
  RevealRequest,
} from './request.js'

// =============================================================================
// RUNTIME TYPES
// =============================================================================

export type {
  DatabaseAdapter,
  DatabaseResult,
  FindArgs,
  OperationOptions,
  PaginatedDocs,
  RevealCollection,
  RevealCreateOptions,
  RevealDeleteOptions,
  RevealFindOptions,
  RevealGlobal,
  RevealPaginatedResult,
  RevealUI,
  RevealUIInstance,
  RevealUILogger,
  RevealUpdateOptions,
  StorageAdapter,
} from './runtime.js'

// =============================================================================
// CONFIG TYPES
// =============================================================================

export type {
  GlobalAfterChangeHook,
  RevealAfterChangeHook,
  RevealAfterReadHook,
  RevealBeforeChangeHook,
  RevealCollectionConfig,
  RevealCollectionHooks,
  RevealConfig,
  RevealGlobalConfig,
  RevealHookContext,
} from './config.js'

// =============================================================================
// HOOK TYPES
// =============================================================================

export type {
  RevealUIFieldHook,
  RevealUIFieldValidator,
  RevealUIHookContext,
  RevealUIValidationRule,
} from './hooks.js'

// =============================================================================
// ACCESS TYPES (RevealUI-specific)
// =============================================================================
// Note: Core AccessFunction, AccessArgs, AccessResult come from @revealui/schema/core'
// These are RevealUI-specific extensions

export type {
  Access,
  FieldAccess,
  RevealUIAccessArgs,
  RevealUIAccessContext,
  RevealUIAccessResult,
  RevealUIAccessRule,
  RevealUIFilterResult,
} from './access.js'

// =============================================================================
// API TYPES
// =============================================================================

export type {
  APIResponse,
  EndpointHandler,
  EndpointHandlerArgs,
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  RESTOptions,
  // Handler types
  RevealHandler,
} from './api.js'

// =============================================================================
// RICH TEXT TYPES
// =============================================================================

export type {
  RichTextEditor,
  RichTextFeature,
} from './richtext.js'

// =============================================================================
// PLUGIN TYPES
// =============================================================================

export type {
  Plugin,
  PluginOptions,
} from './plugins.js'

// =============================================================================
// EXTENSION TYPES
// =============================================================================

export type {
  // Component types
  CustomComponent,
  RevealUICollectionConfig,
  RevealUIComponent,
  RevealUIContext,
  RevealUIEnhancedField,
  RevealUIField,
  RevealUIFieldType,
  RevealUIFrameworkContext,
} from './extensions.js'

// =============================================================================
// INTERNAL TYPES
// =============================================================================

export type {
  Block,
  BlocksField,
  CheckboxField,
  ClientCollectionConfig,
  // Internal types
  ClientConfig,
  // RevealUI block type
  RevealUIBlock,
  RevealUIDependencyCheckArgs,
  RevealUIRichTextAdapter,
  RevealUISchemaArgs,
  RevealUITraverseFieldsArgs,
  RevealUITraverseFieldsResult,
} from './legacy.js'

// =============================================================================
// JOB TYPES
// =============================================================================

export type {
  JobTask,
  JobTaskStatus,
  JobTaskPriority,
  JobWorkflow,
  WorkflowStep,
  JobsConfig,
} from './jobs.js'
