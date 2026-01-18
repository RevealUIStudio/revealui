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
// } from '../foundation/contract.js'
// ============================================
// CORE CONTRACTS
// ============================================
// Temporarily commented out to get CMS running
// export {
//   CollectionContract,
//   type CollectionContractType,
//   createAuthCollectionConfig,
//   createCollectionConfig,
//   createUploadCollectionConfig,
//   isCollectionConfig,
//   parseCollection,
//   validateCollection,
// } from './collection.js'
// ============================================
// CMS COMPATIBILITY
// ============================================
// Temporarily commented out to get CMS running
// export {
//   assertValidSlug,
//   fromCMSCollectionConfig,
//   fromCMSGlobalConfig,
//   getRevealUIExtensions,
//   // RevealUI extensions
//   hasRevealUIExtensions,
//   // Slug utilities
//   isValidSlug,
//   type RevealUICollectionConfig,
//   type RevealUIExtensions,
//   type RevealUIGlobalConfig,
//   // Adapters
//   toCMSCollectionConfig,
//   toCMSConfig,
//   toCMSGlobalConfig,
//   toSlug,
// } from './compat.js'
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
  FieldAfterReadHook,
  FieldAfterReadHookArgs,
  FieldBeforeChangeHook,
  // Field hook types
  FieldBeforeChangeHookArgs,
  FieldHooksConfig,
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
  // Request type
  RevealRequest,
  Where,
} from './functions.js'
export {
  GlobalContract,
  type GlobalContractType,
  createGlobalConfig,
  isGlobalConfig,
  parseGlobal,
  validateGlobal,
} from './global.js'
// ============================================
// STRUCTURE SCHEMAS (Zod)
// ============================================
export {
  type AuthConfig,
  AuthConfigSchema,
  COLLECTION_SCHEMA_VERSION,
  type BlockDefinition,
  BlockDefinitionSchema,
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
  ArrayFieldSchema,
  FieldAccessConfigSchema,
  type FieldAdminConfig,
  FieldAdminConfigSchema,
  FieldHooksConfigSchema,
  type FieldOption,
  FieldOptionSchema,
  FieldSchema,
  type FieldStructure,
  FieldStructureSchema,
  GroupFieldSchema,
  NumberFieldSchema,
  RelationshipFieldSchema,
  RowFieldSchema,
  SelectFieldSchema,
  TabsFieldSchema,
  TextFieldSchema,
  // Structure types
  type FieldType,
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
  SanitizedCollectionConfigSchema,
  type SanitizedCollectionConfig,
  SanitizedGlobalConfigSchema,
  type SanitizedGlobalConfig,
  type TabDefinition,
  TabDefinitionSchema,
  type TypeScriptConfig,
  TypeScriptConfigSchema,
  type UploadConfig,
  UploadConfigSchema,
  type GlobalVersionsConfig,
  GlobalVersionsConfigSchema,
  type VersionConfig,
  VersionConfigSchema,
  VersionsConfigSchema,
} from './structure.js'
