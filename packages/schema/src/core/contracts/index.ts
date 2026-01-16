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
 * @module @revealui/schema/core/contracts
 */

// ============================================
// UNIFIED CONTRACT SYSTEM
// ============================================
export {
  contractRegistry,
  createContract,
  type Contract,
  type ContractMetadata,
  type ContractType,
  type ContractValidationFailure,
  type ContractValidationResult,
  type ContractValidationSuccess,
  type CreateContractOptions,
} from './contract'
// ============================================
// CORE CONTRACTS
// ============================================
export {
  CollectionContract,
  type CollectionContractType,
  isCollectionConfig,
  parseCollection,
  validateCollection,
} from './collection'
export {
  FieldContract,
  type FieldContractType,
  isFieldConfig,
  parseField,
  validateField,
} from './field'
export {
  GlobalContract,
  type GlobalContractType,
  isGlobalConfig,
  parseGlobal,
  validateGlobal,
} from './global'
export {
  ConfigContract,
  type ConfigContractType,
  isConfigStructure,
  parseConfigStructure,
  validateConfigStructure,
} from './config-contract'

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
} from './compat'
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
  GraphQLConfig,
  LocalizationConfig,
  SanitizedConfig,
  // Typed variants for advanced usage
  TypedCollectionConfig,
  TypedGlobalConfig,
} from './config'
export {
  defineCollection,
  defineField,
  defineGlobal,
} from './config'
// ============================================
// ERROR HANDLING
// ============================================
export {
  ConfigValidationError,
  safeValidate,
  type ValidationResult,
  validateWithErrors,
} from './errors'
// ============================================
// EXTENSIBILITY
// ============================================
export type {
  CustomFieldTypeConfig,
  CustomFieldTypeRegistry,
  CustomValidationRule,
  PluginFieldExtension,
  ValidationRuleRegistry,
} from './extensibility'
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
} from './extensibility'
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
} from './functions'
// ============================================
// STRUCTURE SCHEMAS (Zod)
// ============================================
export {
  type AuthConfig,
  AuthConfigSchema,
  type BlockDefinition,
  BlockDefinitionSchema,
  type CollectionAdminConfig,
  CollectionAdminConfigSchema,
  type CollectionLabels,
  // Collection schemas
  CollectionLabelsSchema,
  type CollectionStructure,
  CollectionStructureSchema,
  type FieldAdminConfig,
  FieldAdminConfigSchema,
  type FieldOption,
  FieldOptionSchema,
  type FieldStructure,
  FieldStructureSchema,
  // Structure types
  type FieldType,
  // Field schemas
  FieldTypeSchema,
  type GlobalAdminConfig,
  GlobalAdminConfigSchema,
  type GlobalLabels,
  // Global schemas
  GlobalLabelsSchema,
  type GlobalStructure,
  GlobalStructureSchema,
  type TabDefinition,
  TabDefinitionSchema,
  type TypeScriptConfig,
  TypeScriptConfigSchema,
  type UploadConfig,
  UploadConfigSchema,
  type VersionConfig,
  VersionConfigSchema,
} from './structure'
