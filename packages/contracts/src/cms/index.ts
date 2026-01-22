/**
 * CMS Contracts
 *
 * This module exports all contract types for the CMS type system.
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
// CONFIG CONTRACTS
// ============================================
export {
  ConfigContract,
  type ConfigContractType,
  isConfigStructure,
  parseConfigStructure,
  validateConfigStructure,
} from './config-contract.js'

export {
  defineCollection,
  defineField,
  defineGlobal,
} from './config.js'

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
  TypedCollectionConfig,
  TypedGlobalConfig,
} from './config.js'

// ============================================
// FIELD CONTRACTS
// ============================================
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

export type {
  ArrayField,
  GroupField,
  NumberField,
  RelationshipField,
  TextField,
  SelectField,
  TabsField,
  RowField,
} from './structure.js'

// ============================================
// GLOBAL CONTRACTS
// ============================================
export {
  createGlobalConfig,
  GlobalContract,
  type GlobalContractType,
  isGlobalConfig,
  parseGlobal,
  validateGlobal,
} from './global.js'


// ============================================
// FUNCTION CONTRACTS (TypeScript-only types)
// ============================================
export type {
  AccessArgs,
  AccessFunction,
  AccessResult,
  AfterChangeHookArgs,
  AfterDeleteHookArgs,
  AfterOperationHookArgs,
  AfterReadHookArgs,
  BeforeChangeHookArgs,
  BeforeDeleteHookArgs,
  BeforeOperationHookArgs,
  BeforeReadHookArgs,
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
  CollectionBeforeValidateHook,
  CollectionHooksConfig,
  ConditionFunction,
  EndpointConfig,
  EndpointHandler,
  FieldAccess,
  FieldAccessArgs,
  FieldAccessConfig,
  FieldAccessFunction,
  FieldHooksConfig,
  FieldAfterReadHook,
  FieldAfterReadHookArgs,
  FieldBeforeChangeHook,
  FieldBeforeChangeHookArgs,
  GlobalAccessConfig,
  GlobalAfterChangeHook,
  GlobalAfterReadHook,
  GlobalBeforeChangeHook,
  GlobalBeforeReadHook,
  GlobalHooksConfig,
  RevealRequest,
  Where,
} from './functions.js'

// ============================================
// STRUCTURE SCHEMAS (Zod)
// ============================================
export {
  ArrayFieldSchema,
  AuthConfigSchema,
  BlockDefinitionSchema,
  COLLECTION_SCHEMA_VERSION,
  CollectionAccessSchema,
  CollectionAdminConfigSchema,
  CollectionConfigSchema,
  CollectionHooksSchema,
  CollectionLabelsSchema,
  CollectionStructureSchema,
  FIELD_SCHEMA_VERSION,
  FieldAccessConfigSchema,
  FieldAdminConfigSchema,
  FieldHooksConfigSchema,
  FieldOptionSchema,
  FieldSchema,
  FieldStructureSchema,
  FieldTypeSchema,
  GLOBAL_SCHEMA_VERSION,
  GlobalAccessSchema,
  GlobalAdminConfigSchema,
  GlobalConfigSchema,
  GlobalHooksSchema,
  GlobalLabelsSchema,
  GlobalStructureSchema,
  GlobalVersionsConfigSchema,
  GroupFieldSchema,
  NumberFieldSchema,
  RelationshipFieldSchema,
  RowFieldSchema,
  SanitizedCollectionConfigSchema,
  SanitizedGlobalConfigSchema,
  SelectFieldSchema,
  TabDefinitionSchema,
  TabsFieldSchema,
  TextFieldSchema,
  TypeScriptConfigSchema,
  UploadConfigSchema,
  VersionConfigSchema,
  VersionsConfigSchema,
} from './structure.js'

export type {
  AuthConfig,
  BlockDefinition,
  CollectionAccess,
  CollectionAdminConfig,
  CollectionHooks,
  CollectionLabels,
  CollectionStructure,
  FieldAdminConfig,
  FieldOption,
  FieldStructure,
  FieldType,
  GlobalAccess,
  GlobalAdminConfig,
  GlobalHooks,
  GlobalLabels,
  GlobalStructure,
  GlobalVersionsConfig,
  SanitizedCollectionConfig,
  SanitizedGlobalConfig,
  TabDefinition,
  TypeScriptConfig,
  UploadConfig,
  VersionConfig,
} from './structure.js'

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
  mergeFields,
  registerCustomFieldType,
  registerPluginExtension,
  registerValidationRule,
  runValidationRule,
  unregisterCustomFieldType,
} from './extensibility.js'

// ============================================
// CMS COMPATIBILITY
// ============================================
export {
  assertValidSlug,
  fromCMSCollectionConfig,
  fromCMSGlobalConfig,
  getRevealUIExtensions,
  hasRevealUIExtensions,
  isValidSlug,
  toCMSCollectionConfig,
  toCMSConfig,
  toCMSGlobalConfig,
  toSlug,
} from './compat.js'

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