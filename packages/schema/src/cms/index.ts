/**
 * @revealui/schema/cms
 *
 * CMS Contracts Layer
 *
 * This module defines the schema contracts for CMS configuration.
 * All types are derived from Zod schemas, ensuring:
 *
 * 1. Single source of truth - schemas define types
 * 2. Runtime validation - config errors caught early
 * 3. Self-documenting - constraints are explicit
 * 4. Extensible - passthrough allows custom properties
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   CollectionConfigSchema,
 *   type CollectionConfig,
 *   createCollectionConfig,
 * } from '@revealui/schema/cms'
 *
 * // Validate config at runtime
 * const config = CollectionConfigSchema.parse(rawConfig)
 *
 * // Use factory for common patterns
 * const posts = createCollectionConfig('posts', [
 *   { name: 'title', type: 'text', required: true },
 *   { name: 'content', type: 'richText' },
 * ])
 * ```
 *
 * @packageDocumentation
 */

// Re-export zod for consumers
export { z } from 'zod'

// =============================================================================
// Field Contracts
// =============================================================================

export {
  // Version
  FIELD_SCHEMA_VERSION,
  // Field Type
  FieldTypeSchema,
  type FieldType,
  // Admin Config
  FieldAdminConfigSchema,
  type FieldAdminConfig,
  // Access Config
  FieldAccessConfigSchema,
  type FieldAccessConfig,
  // Hooks Config
  FieldHooksConfigSchema,
  type FieldHooksConfig,
  // Options
  FieldOptionSchema,
  type FieldOption,
  // Tab Definition
  TabDefinitionSchema,
  type TabDefinition,
  // Base Field Schema (for validation)
  BaseFieldSchema,
  FieldSchema,
  // Note: Field type is exported from contracts for consistency
  // Specific Field Types
  TextFieldSchema,
  NumberFieldSchema,
  RelationshipFieldSchema,
  ArrayFieldSchema,
  GroupFieldSchema,
  SelectFieldSchema,
  RowFieldSchema,
  TabsFieldSchema,
  type TextField,
  type NumberField,
  type RelationshipField,
  type ArrayField,
  type GroupField,
  type SelectField,
  type RowField,
  type TabsField,
  // Type Guards
  isTextField,
  isNumberField,
  isRelationshipField,
  isArrayField,
  isGroupField,
  isLayoutField,
  hasNestedFields,
} from './field.js'

// =============================================================================
// Collection Contracts
// =============================================================================

export {
  // Version
  COLLECTION_SCHEMA_VERSION,
  // Labels
  CollectionLabelsSchema,
  type CollectionLabels,
  // Access
  CollectionAccessSchema,
  type CollectionAccess,
  // Hooks
  CollectionHooksSchema,
  type CollectionHooks,
  // Admin Config
  CollectionAdminConfigSchema,
  type CollectionAdminConfig,
  // Upload Config
  UploadConfigSchema,
  type UploadConfig,
  // Auth Config
  AuthConfigSchema,
  type AuthConfig,
  // Versions Config
  VersionsConfigSchema,
  type VersionsConfig,
  // Collection Config Schema (type is exported from contracts)
  CollectionConfigSchema,
  // Sanitized Config
  SanitizedCollectionConfigSchema,
  type SanitizedCollectionConfig,
  // Factory Functions
  createCollectionConfig,
  createAuthCollectionConfig,
  createUploadCollectionConfig,
} from './collection.js'

// =============================================================================
// Global Contracts
// =============================================================================

export {
  // Version
  GLOBAL_SCHEMA_VERSION,
  // Labels
  GlobalLabelsSchema,
  type GlobalLabels,
  // Access
  GlobalAccessSchema,
  type GlobalAccess,
  // Hooks
  GlobalHooksSchema,
  type GlobalHooks,
  // Admin Config
  GlobalAdminConfigSchema,
  type GlobalAdminConfig,
  // Versions Config
  GlobalVersionsConfigSchema,
  type GlobalVersionsConfig,
  // Global Config Schema (type is exported from contracts)
  GlobalConfigSchema,
  // Sanitized Config
  SanitizedGlobalConfigSchema,
  type SanitizedGlobalConfig,
  // Factory Functions
  createGlobalConfig,
} from './global.js'

// =============================================================================
// New Contracts (Hybrid Approach)
// =============================================================================

export {
  // Error handling
  ConfigValidationError,
  validateWithErrors,
  safeValidate,
  type ValidationResult,
  // Structure schemas
  FieldStructureSchema,
  CollectionStructureSchema,
  GlobalStructureSchema,
  type FieldStructure,
  type CollectionStructure,
  type GlobalStructure,
  // Function contracts (TypeScript-only)
  type RevealRequest,
  type AccessResult,
  type Where,
  type AccessArgs,
  type AccessFunction,
  type CollectionAccessConfig,
  type FieldAccessArgs,
  type FieldAccessFunction,
  type FieldAccess,
  type GlobalAccessConfig,
  // Hook types
  type BeforeValidateHookArgs,
  type BeforeChangeHookArgs,
  type AfterChangeHookArgs,
  type AfterReadHookArgs,
  type CollectionBeforeValidateHook,
  type CollectionBeforeChangeHook,
  type CollectionAfterChangeHook,
  type CollectionBeforeReadHook,
  type CollectionAfterReadHook,
  type CollectionHooksConfig,
  type FieldHooksConfig as FieldHooksConfigNew,
  type GlobalHooksConfig,
  // Validation
  type FieldValidateArgs,
  type FieldValidateFunction,
  // Combined types (unified Field type from contracts)
  type Field,
  type CollectionConfig,
  type GlobalConfig,
  type Config,
  type SanitizedConfig,
  type TypedCollectionConfig,
  type TypedGlobalConfig,
  // Helpers
  defineCollection,
  defineGlobal,
  defineField,
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
  toCMSConfig,
  fromCMSCollectionConfig,
  fromCMSGlobalConfig,
  // RevealUI extensions
  hasRevealUIExtensions,
  getRevealUIExtensions,
  isValidSlug,
  toSlug,
  assertValidSlug,
  type RevealUIExtensions,
  type RevealUICollectionConfig,
  type RevealUIGlobalConfig,
} from './contracts/index.js'
