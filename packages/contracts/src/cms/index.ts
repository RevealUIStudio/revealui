/**
 * CMS Contracts
 *
 * This module exports all contract types for the CMS type system.
 *
 * Architecture:
 * - Unified Contract System: Single source of truth combining types, schemas, and validation
 * - Structure schemas (Zod): Runtime validation of config structure
 * - Function contracts (TypeScript): Compile-time validation of function signatures
 * - Combined types: Complete config types merging both
 * - Extensibility: Custom field types and plugin extensions
 * - Errors: Detailed validation error handling
 *
 * @module @revealui/contracts/cms
 */

// ============================================
// UNIFIED CONTRACT SYSTEM
// ============================================
export {
  type Contract,
  type ContractMetadata,
  type ContractType,
  type ContractValidationFailure,
  type ContractValidationResult,
  type ContractValidationSuccess,
  type CreateContractOptions,
  contractRegistry,
  createContract,
} from '../foundation/contract.js'
// ============================================
// CORE CONTRACTS
// ============================================
export {
  CollectionContract,
  type CollectionContractType,
  createAuthCollectionConfig,
  createCollectionConfig,
  createUploadCollectionConfig,
  isCollectionConfig,
  parseCollection,
  validateCollection,
} from './collection.js'
// ============================================
// CMS COMPATIBILITY
// ============================================
export {
  assertValidSlug,
  fromCMSCollectionConfig,
  fromCMSGlobalConfig,
  getRevealUIExtensions,
  // RevealUI extensions
  hasRevealUIExtensions,
  // Slug utilities
  isValidSlug,
  type RevealUICollectionConfig,
  type RevealUIExtensions,
  type RevealUIGlobalConfig,
  // Adapters
  toCMSCollectionConfig,
  toCMSConfig,
  toCMSGlobalConfig,
  toSlug,
} from './compat.js'
// ============================================
// COMBINED CONFIG TYPES
// ============================================
export type {
  AdminConfig,
  CollectionConfig,
  Config,
  DatabaseAdapterConfig,
  EmailConfig,
  Field,
  GlobalConfig,
  LocalizationConfig,
  SanitizedConfig,
  // Typed variants for advanced usage
  TypedCollectionConfig,
  TypedGlobalConfig,
} from './config.js'
export {
  defineCollection,
  defineField,
  defineGlobal,
} from './config.js'
export {
  ConfigContract,
  type ConfigContractType,
  isConfigStructure,
  parseConfigStructure,
  validateConfigStructure,
} from './config-contract.js'
// ============================================
// MISSING CONFIG TYPE EXPORTS
// ============================================
export type {
  RevealUICollectionConfig,
  RevealUIExtensions,
  RevealUIGlobalConfig,
} from './compat.js'
// ============================================
// ERROR HANDLING
// ============================================
export {
  ConfigValidationError,
  safeValidate,
  type ValidationResult,
  validateWithErrors,
} from './errors.js'
// ============================================
// EXTENSIBILITY
// ============================================
export type {
  CustomFieldTypeConfig,
  CustomFieldTypeRegistry,
  CustomValidationRule,
  PluginFieldExtension,
  ValidationRuleRegistry,
  ValidationRuleRegistry,
} from './extensibility.js'
export {
  applyPluginExtensions,
  BUILTIN_FIELD_TYPES,
  type BuiltinFieldType,
  clearCustomFieldTypes,
  clearPluginExtensions,
  ExtendedFieldTypeSchema,
  getCustomFieldType,
  getCustomFieldTypes,
  getPluginExtensions,
  getValidationRule,
  getValidationRules,
  getValidFieldTypes,
  isValidFieldType,
  mergeCollectionConfigs,
  // Utilities
  mergeFields,
  // Custom field types
  registerCustomFieldType,
  // Plugin extensions
  registerPluginExtension,
  // Validation rules
  registerValidationRule,
  runValidationRule,
  unregisterCustomFieldType,
} from './extensibility.js'
export {
  FieldContract,
  type FieldContractType,
  hasNestedFields,
  isArrayField,
  isFieldConfig,
  isGroupField,
  isLayoutField,
  isNumberField,
  isRelationshipField,
  isTextField,
  parseField,
  validateField,
} from './field.js'
// ============================================
// MISSING FIELD TYPE EXPORTS
// ============================================
export type {
  ArrayField,
  GroupField,
  NumberField,
  RelationshipField,
  TextField,
  SelectField,
  TabsField,
  RowField,
} from './field.js'
// ============================================
// FUNCTION CONTRACTS (TypeScript)
// ============================================
export type {
  AccessArgs,
  AccessFunction,
  // Access types
  AccessResult,
  AfterChangeHookArgs,
  AfterDeleteHookArgs,
  AfterOperationHookArgs,
  AfterReadHookArgs,
  BeforeChangeHookArgs,
  BeforeDeleteHookArgs,
  BeforeOperationHookArgs,
  BeforeReadHookArgs,
  // Hook argument types
  BeforeValidateHookArgs,
  CollectionAccessConfig,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionAfterOperationHook,
  CollectionAfterReadHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeOperationHook,
  CollectionBeforeReadHook,
  // Collection hook types
  CollectionBeforeValidateHook,
  CollectionHooksConfig,
  // Other function types
  ConditionFunction,
  EndpointConfig,
  // Endpoints
  EndpointHandler,
  FieldAccess,
  FieldAccessArgs,
  FieldAccessConfig,
  FieldAccessFunction,
  FieldHooksConfig,
  FieldAfterReadHook,
  FieldAfterReadHookArgs,
  FieldBeforeChangeHook,
  // Field hook types
  FieldBeforeChangeHookArgs,
  FieldHooksConfig,
  FieldBeforeReadHook,
  FieldBeforeReadHookArgs,
  FieldAfterReadHook,
  FieldAfterReadHookArgs,
  // Validation
  FieldValidateArgs,
  FieldValidateFunction,
  FilterOptionsFunction,
  GlobalAccessConfig,
  GlobalAfterChangeHook,
  GlobalAfterReadHook,
  GlobalBeforeChangeHook,
  // Global hook types
  GlobalBeforeReadHook,
  GlobalHooksConfig,
  GlobalBeforeValidateHook,
  // Request type
  RevealRequest,
  Where,
  // Missing function types that are still needed
  FilterOptionsFunction,
} from './functions.js'
export {
  createGlobalConfig,
  GlobalContract,
  type GlobalContractType,
  isGlobalConfig,
  parseGlobal,
  validateGlobal,
} from './global.js'
// ============================================
// MISSING UTILITY EXPORTS
// ============================================
export {
  assertValidSlug,
  isValidSlug,
  toSlug,
} from './compat.js'
// ============================================
// MISSING COLLECTION/CONFIG EXPORTS
// ============================================
export {
  createAuthCollectionConfig,
  createCollectionConfig,
  createUploadCollectionConfig,
  isCollectionConfig,
  parseCollection,
  validateCollection,
} from './collection.js'
// ============================================
// MISSING CONFIG EXPORTS
// ============================================
export {
  defineCollection,
  defineField,
  defineGlobal,
} from './config.js'
// ============================================
// MISSING GLOBAL TYPE EXPORTS
// ============================================
export type {
  VersionsConfig,
  GlobalVersionsConfig,
} from './global.js'
// ============================================
// STRUCTURE SCHEMAS (Zod)
// ============================================
export {
  ArrayFieldSchema,
  type AuthConfig,
  AuthConfigSchema,
  type BlockDefinition,
  BlockDefinitionSchema,
  COLLECTION_SCHEMA_VERSION,
  type CollectionAccess,
  CollectionAccessSchema,
  type CollectionAdminConfig,
  CollectionAdminConfigSchema,
  CollectionConfigSchema,
  type CollectionHooks,
  CollectionHooksSchema,
  type CollectionLabels,
  // Collection schemas
  CollectionLabelsSchema,
  type CollectionStructure,
  CollectionStructureSchema,
  FIELD_SCHEMA_VERSION,
  FieldAccessConfigSchema,
  type FieldAdminConfig,
  FieldAdminConfigSchema,
  FieldHooksConfigSchema,
  type FieldOption,
  FieldOptionSchema,
  FieldSchema,
  // Structure types
  type FieldStructure,
  FieldStructureSchema,
  type FieldType,
  // Field validation
  FieldValidateArgs,
  FieldValidateFunction,
  // Field schemas
  FieldTypeSchema,
  GLOBAL_SCHEMA_VERSION,
  type GlobalAccess,
  GlobalAccessSchema,
  type GlobalAdminConfig,
  GlobalAdminConfigSchema,
  GlobalConfigSchema,
  type GlobalHooks,
  GlobalHooksSchema,
  type GlobalLabels,
  // Global schemas
  GlobalLabelsSchema,
  type GlobalStructure,
  GlobalStructureSchema,
  type GlobalVersionsConfig,
  GlobalVersionsConfigSchema,
  GroupFieldSchema,
  NumberFieldSchema,
  RelationshipFieldSchema,
  RowFieldSchema,
  type SanitizedCollectionConfig,
  SanitizedCollectionConfigSchema,
  type   SanitizedGlobalConfig,
  SanitizedGlobalConfigSchema,
  SelectFieldSchema,
  type SanitizedCollectionConfig,
  type SanitizedGlobalConfig,
  type TabDefinition,
  TabDefinitionSchema,
  TabsFieldSchema,
  TextFieldSchema,
  type TypeScriptConfig,
  TypeScriptConfigSchema,
  type UploadConfig,
  UploadConfigSchema,
  type TypeScriptConfig,
  type VersionConfig,
  VersionConfigSchema,
  VersionsConfigSchema,
} from './structure.js'
// ============================================
// MISSING STRUCTURE TYPE EXPORTS
// ============================================
export type {
  AuthConfig,
  BlockDefinition,
  CollectionStructure,
  GlobalStructure,
  // User-related types
  CreateUserInput,
  UpdateUserInput,
  User,
  UserPreferences,
  UserRole,
  UserStatus,
  UserType,
  Session,
  // Version config types
  VersionsConfig,
  VersionConfig,
} from './structure.js'
