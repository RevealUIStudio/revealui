/**
 * RevealUI CMS Framework - Type System
 *
 * This module consolidates the CMS type system using @revealui/schema contracts
 * as the single source of truth, while extending with RevealUI-specific features.
 *
 * ## Architecture
 *
 * 1. **Schema Contracts** (@revealui/schema/cms)
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
  // Field contracts
  FIELD_SCHEMA_VERSION,
  FieldTypeSchema,
  FieldAdminConfigSchema,
  FieldAccessConfigSchema,
  FieldHooksConfigSchema,
  FieldOptionSchema,
  TabDefinitionSchema,
  FieldSchema,
  TextFieldSchema,
  NumberFieldSchema,
  RelationshipFieldSchema,
  ArrayFieldSchema,
  GroupFieldSchema,
  SelectFieldSchema,
  RowFieldSchema,
  TabsFieldSchema,
  // Field types
  type FieldType,
  type FieldAdminConfig,
  type FieldAccessConfig,
  type FieldHooksConfig,
  type FieldOption,
  type TabDefinition,
  type Field,
  type TextField,
  type NumberField,
  type RelationshipField,
  type ArrayField,
  type GroupField,
  type SelectField,
  type RowField,
  type TabsField,
  // Field type guards
  isTextField,
  isNumberField,
  isRelationshipField,
  isArrayField,
  isGroupField,
  isLayoutField,
  hasNestedFields,
  // Collection contracts
  COLLECTION_SCHEMA_VERSION,
  CollectionLabelsSchema,
  CollectionAccessSchema,
  CollectionHooksSchema,
  CollectionAdminConfigSchema,
  UploadConfigSchema,
  AuthConfigSchema,
  VersionsConfigSchema,
  CollectionConfigSchema,
  SanitizedCollectionConfigSchema,
  type CollectionLabels,
  type CollectionAccess,
  type CollectionHooks,
  type CollectionAdminConfig,
  type UploadConfig,
  type AuthConfig,
  type VersionsConfig,
  type CollectionConfig,
  type SanitizedCollectionConfig,
  // Collection factories
  createCollectionConfig,
  createAuthCollectionConfig,
  createUploadCollectionConfig,
  // Global contracts
  GLOBAL_SCHEMA_VERSION,
  GlobalLabelsSchema,
  GlobalAccessSchema,
  GlobalHooksSchema,
  GlobalAdminConfigSchema,
  GlobalVersionsConfigSchema,
  GlobalConfigSchema,
  SanitizedGlobalConfigSchema,
  type GlobalLabels,
  type GlobalAccess,
  type GlobalHooks,
  type GlobalAdminConfig,
  type GlobalVersionsConfig,
  type GlobalConfig,
  type SanitizedGlobalConfig,
  // Global factories
  createGlobalConfig,
  // Zod for runtime validation
  z,
  // ==========================================================================
  // HYBRID CONTRACTS
  // ==========================================================================
  // Error handling
  ConfigValidationError,
  validateWithErrors,
  safeValidate,
  type ValidationResult,
  // Structure schemas (Zod - runtime validation)
  FieldStructureSchema,
  CollectionStructureSchema,
  GlobalStructureSchema,
  type FieldStructure,
  type CollectionStructure,
  type GlobalStructure,
  // Function contracts (TypeScript - compile time)
  type AccessFunction,
  type CollectionAccessConfig,
  type FieldAccessFunction,
  type FieldAccess as SchemaFieldAccess,
  type GlobalAccessConfig,
  type Where,
  type AccessResult,
  type AccessArgs,
  // Hook type contracts
  type CollectionBeforeValidateHook,
  type CollectionBeforeChangeHook,
  type CollectionAfterChangeHook,
  type CollectionBeforeReadHook,
  type CollectionAfterReadHook,
  type CollectionHooksConfig,
  type GlobalHooksConfig,
  type BeforeChangeHookArgs,
  type AfterChangeHookArgs,
  type AfterReadHookArgs,
  // Validation contracts
  type FieldValidateFunction,
  type FieldValidateArgs,
  // Config helpers
  defineCollection,
  defineGlobal,
  defineField,
  type Config,
  type SanitizedConfig,
  // Extensibility
  registerCustomFieldType,
  getCustomFieldType,
  isValidFieldType,
  ExtendedFieldTypeSchema,
  registerPluginExtension,
  applyPluginExtensions,
  mergeFields,
  mergeCollectionConfigs,
  type CustomFieldTypeConfig,
  type PluginFieldExtension,
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
  type RevealUIExtensions,
  type RevealUICollectionConfig as SchemaRevealUICollectionConfig,
  type RevealUIGlobalConfig as SchemaRevealUIGlobalConfig,
} from '@revealui/schema/cms'

// =============================================================================
// QUERY TYPES
// =============================================================================

export {
  RevealOperators,
  type RevealOperator,
  type RevealValue,
  type RevealDataObject,
  type RevealWhereField,
  type RevealWhere,
  type RevealSort,
  type RevealSelect,
  type RevealDocument,
  type RevealDocumentWithMeta,
  type TypeWithID,
  type PopulateType,
  type SelectType,
  type JsonObject,
  type WhereClause,
  // New exports
  type TypedFallbackLocale,
  type SelectMode,
  type RelationshipMetadata,
  type Document,
} from './query'

// =============================================================================
// USER TYPES
// =============================================================================

export {
  type RevealUser,
  type User,
  type RevealUIUser,
  type RevealUITenant,
  type RevealUIPermission,
  type Permission,
} from './user'

// =============================================================================
// REQUEST TYPES
// =============================================================================

export {
  type RevealRequest,
  type RequestContext,
} from './request'

// =============================================================================
// RUNTIME TYPES
// =============================================================================

export {
  type RevealUILogger,
  type RevealFindOptions,
  type RevealCreateOptions,
  type RevealUpdateOptions,
  type RevealDeleteOptions,
  type OperationOptions,
  type RevealPaginatedResult,
  type PaginatedDocs,
  type RevealUIInstance,
  type RevealUI,
  type RevealCollection,
  type RevealGlobal,
  type DatabaseResult,
  type DatabaseAdapter,
  type StorageAdapter,
  type FindArgs,
} from './runtime'

// =============================================================================
// CONFIG TYPES
// =============================================================================

export {
  type RevealHookContext,
  type RevealAfterChangeHook,
  type GlobalAfterChangeHook,
  type RevealBeforeChangeHook,
  type RevealAfterReadHook,
  type RevealCollectionHooks,
  type RevealConfig,
  type RevealCollectionConfig,
  type RevealGlobalConfig,
} from './config'

// =============================================================================
// HOOK TYPES
// =============================================================================

export {
  type RevealUIHookContext,
  type RevealUIFieldHook,
  type RevealUIValidationRule,
  type RevealUIFieldValidator,
} from './hooks'

// =============================================================================
// ACCESS TYPES (RevealUI-specific)
// =============================================================================
// Note: Core AccessFunction, AccessArgs, AccessResult come from @revealui/schema/cms
// These are RevealUI-specific extensions

export {
  type Access,
  type FieldAccess,
  type RevealUIAccessResult,
  type RevealUIAccessContext,
  type RevealUIFilterResult,
  type RevealUIAccessRule,
  type RevealUIAccessArgs,
} from './access'

// =============================================================================
// API TYPES
// =============================================================================

export {
  type RESTOptions,
  type APIResponse,
  type REST_DELETE,
  type REST_GET,
  type REST_OPTIONS,
  type REST_PATCH,
  type REST_POST,
  // Handler types
  type RevealHandler,
  type EndpointHandler,
  type EndpointHandlerArgs,
} from './api'

// =============================================================================
// RICH TEXT TYPES
// =============================================================================

export {
  type RichTextFeature,
  type RichTextEditor,
} from './richtext'

// =============================================================================
// PLUGIN TYPES
// =============================================================================

export {
  type Plugin,
  type PluginOptions,
} from './plugins'

// =============================================================================
// EXTENSION TYPES
// =============================================================================

export {
  type RevealUIContext,
  type RevealUIFrameworkContext,
  type RevealUICollectionConfig,
  type RevealUIField,
  type RevealUIFieldType,
  type RevealUIEnhancedField,
  // Component types
  type CustomComponent,
  type RevealUIComponent,
} from './extensions'

// =============================================================================
// INTERNAL TYPES
// =============================================================================

export {
  type Block,
  type CheckboxField,
  type BlocksField,
  // RevealUI block type
  type RevealUIBlock,
  // Internal types
  type ClientConfig,
  type ClientCollectionConfig,
  type RevealUITraverseFieldsArgs,
  type RevealUITraverseFieldsResult,
  type RevealUIDependencyCheckArgs,
  type RevealUISchemaArgs,
  type RevealUIRichTextAdapter,
} from './legacy'
