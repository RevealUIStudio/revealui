/**
 * Admin Contracts
 *
 * This module exports all contract types for the admin type system.
 *
 * @module @revealui/contracts/admin
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
} from '../foundation/contract.js';

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
} from './collection.js';
export type {
  RevealUICollectionConfig,
  RevealUIExtensions,
  RevealUIGlobalConfig,
} from './compat.js';
// ============================================
// admin COMPATIBILITY
// ============================================
export {
  assertValidSlug,
  fromAdminCollectionConfig,
  fromAdminGlobalConfig,
  getRevealUIExtensions,
  hasRevealUIExtensions,
  isValidSlug,
  toAdminCollectionConfig,
  toAdminConfig,
  toAdminGlobalConfig,
  toSlug,
} from './compat.js';

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
  UnknownRecord,
} from './config.js';
export {
  defineCollection,
  defineField,
  defineGlobal,
} from './config.js';
// ============================================
// CONFIG CONTRACTS
// ============================================
export {
  ConfigContract,
  type ConfigContractType,
  isConfigStructure,
  parseConfigStructure,
  validateConfigStructure,
} from './config-contract.js';
// ============================================
// ERROR HANDLING
// ============================================
export {
  ConfigValidationError,
  safeValidate,
  type ValidationResult,
  validateWithErrors,
} from './errors.js';
// ============================================
// EXTENSIBILITY
// ============================================
export type {
  CustomFieldTypeConfig,
  CustomFieldTypeRegistry,
  CustomValidationRule,
  PluginFieldExtension,
  ValidationRuleRegistry,
} from './extensibility.js';
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
} from './extensibility.js';
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
} from './field.js';
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
  BaseRevealUser,
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
  FieldAfterReadHook,
  FieldAfterReadHookArgs,
  FieldBeforeChangeHook,
  FieldBeforeChangeHookArgs,
  FieldHooksConfig,
  FieldValidateArgs,
  GlobalAccessConfig,
  GlobalAfterChangeHook,
  GlobalAfterReadHook,
  GlobalBeforeChangeHook,
  GlobalBeforeReadHook,
  GlobalHooksConfig,
  RevealAdminInstance,
  RevealRequest,
  Where,
} from './functions.js';
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
} from './global.js';
export type {
  ArrayField,
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
  GroupField,
  NumberField,
  RelationshipField,
  RowField,
  SanitizedCollectionConfig,
  SanitizedGlobalConfig,
  SelectField,
  TabDefinition,
  TabsField,
  TextField,
  TypeScriptConfig,
  UploadConfig,
  VersionConfig,
} from './structure.js';
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
} from './structure.js';
