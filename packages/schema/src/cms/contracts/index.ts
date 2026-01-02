/**
 * CMS Contracts
 * 
 * This module exports all contract types for the CMS type system.
 * 
 * Architecture:
 * - Structure schemas (Zod): Runtime validation of config structure
 * - Function contracts (TypeScript): Compile-time validation of function signatures
 * - Combined types: Complete config types merging both
 * - Extensibility: Custom field types and plugin extensions
 * - Errors: Detailed validation error handling
 * 
 * @module @revealui/schema/cms/contracts
 */

// ============================================
// ERROR HANDLING
// ============================================
export {
  ConfigValidationError,
  validateWithErrors,
  safeValidate,
  type ValidationResult,
} from './errors';

// ============================================
// STRUCTURE SCHEMAS (Zod)
// ============================================
export {
  // Field schemas
  FieldTypeSchema,
  FieldAdminConfigSchema,
  FieldOptionSchema,
  BlockDefinitionSchema,
  TabDefinitionSchema,
  FieldStructureSchema,
  
  // Collection schemas
  CollectionLabelsSchema,
  CollectionAdminConfigSchema,
  VersionConfigSchema,
  UploadConfigSchema,
  AuthConfigSchema,
  TypeScriptConfigSchema,
  CollectionStructureSchema,
  
  // Global schemas
  GlobalLabelsSchema,
  GlobalAdminConfigSchema,
  GlobalStructureSchema,
  
  // Structure types
  type FieldType,
  type FieldAdminConfig,
  type FieldOption,
  type BlockDefinition,
  type TabDefinition,
  type FieldStructure,
  type CollectionLabels,
  type CollectionAdminConfig,
  type VersionConfig,
  type UploadConfig,
  type AuthConfig,
  type TypeScriptConfig,
  type CollectionStructure,
  type GlobalLabels,
  type GlobalAdminConfig,
  type GlobalStructure,
} from './structure';

// ============================================
// FUNCTION CONTRACTS (TypeScript)
// ============================================
export type {
  // Request type
  PayloadRequest,
  
  // Access types
  AccessResult,
  Where,
  AccessArgs,
  AccessFunction,
  CollectionAccessConfig,
  FieldAccessArgs,
  FieldAccessFunction,
  FieldAccessConfig,
  FieldAccess,
  GlobalAccessConfig,
  
  // Hook argument types
  BeforeValidateHookArgs,
  BeforeChangeHookArgs,
  AfterChangeHookArgs,
  BeforeReadHookArgs,
  AfterReadHookArgs,
  BeforeDeleteHookArgs,
  AfterDeleteHookArgs,
  BeforeOperationHookArgs,
  AfterOperationHookArgs,
  
  // Collection hook types
  CollectionBeforeValidateHook,
  CollectionBeforeChangeHook,
  CollectionAfterChangeHook,
  CollectionBeforeReadHook,
  CollectionAfterReadHook,
  CollectionBeforeDeleteHook,
  CollectionAfterDeleteHook,
  CollectionBeforeOperationHook,
  CollectionAfterOperationHook,
  CollectionHooksConfig,
  
  // Field hook types
  FieldBeforeChangeHookArgs,
  FieldAfterReadHookArgs,
  FieldBeforeChangeHook,
  FieldAfterReadHook,
  FieldHooksConfig,
  
  // Global hook types
  GlobalBeforeReadHook,
  GlobalAfterReadHook,
  GlobalBeforeChangeHook,
  GlobalAfterChangeHook,
  GlobalHooksConfig,
  
  // Validation
  FieldValidateArgs,
  FieldValidateFunction,
  
  // Endpoints
  EndpointHandler,
  EndpointConfig,
  
  // Other function types
  ConditionFunction,
  FilterOptionsFunction,
} from './functions';

// ============================================
// COMBINED CONFIG TYPES
// ============================================
export type {
  Field,
  CollectionConfig,
  GlobalConfig,
  Config,
  SanitizedConfig,
  DatabaseAdapterConfig,
  EmailConfig,
  AdminConfig,
  LocalizationConfig,
  GraphQLConfig,
  // Typed variants for advanced usage
  TypedCollectionConfig,
  TypedGlobalConfig,
} from './config';

export {
  defineCollection,
  defineGlobal,
  defineField,
} from './config';

// ============================================
// EXTENSIBILITY
// ============================================
export type {
  CustomFieldTypeConfig,
  CustomFieldTypeRegistry,
  PluginFieldExtension,
  CustomValidationRule,
  ValidationRuleRegistry,
} from './extensibility';

export {
  // Custom field types
  registerCustomFieldType,
  getCustomFieldType,
  getCustomFieldTypes,
  unregisterCustomFieldType,
  clearCustomFieldTypes,
  isValidFieldType,
  getValidFieldTypes,
  ExtendedFieldTypeSchema,
  BUILTIN_FIELD_TYPES,
  type BuiltinFieldType,
  
  // Plugin extensions
  registerPluginExtension,
  getPluginExtensions,
  clearPluginExtensions,
  applyPluginExtensions,
  
  // Validation rules
  registerValidationRule,
  getValidationRule,
  getValidationRules,
  runValidationRule,
  
  // Utilities
  mergeFields,
  mergeCollectionConfigs,
} from './extensibility';

// ============================================
// PAYLOAD COMPATIBILITY
// ============================================
export {
  // Adapters
  toPayloadCollectionConfig,
  toPayloadGlobalConfig,
  toPayloadConfig,
  fromPayloadCollectionConfig,
  fromPayloadGlobalConfig,
  
  // RevealUI extensions
  hasRevealUIExtensions,
  getRevealUIExtensions,
  type RevealUIExtensions,
  type RevealUICollectionConfig,
  type RevealUIGlobalConfig,
  
  // Deprecated (backward compatibility)
  type RevealCollectionConfig,
  type RevealGlobalConfig,
  
  // Slug utilities
  isValidSlug,
  toSlug,
  assertValidSlug,
} from './payload-compat';
