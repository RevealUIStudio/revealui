/**
 * @revealui/schema/core
 *
 * Core Contracts Layer
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
 * } from '@revealui/schema/core'
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
  type ArrayField,
  ArrayFieldSchema,
  // Version
  FIELD_SCHEMA_VERSION,
  type FieldAccessConfig,
  // Access Config
  FieldAccessConfigSchema,
  type FieldAdminConfig,
  // Admin Config
  FieldAdminConfigSchema,
  type FieldHooksConfig,
  // Hooks Config
  FieldHooksConfigSchema,
  type FieldOption,
  // Options
  FieldOptionSchema,
  // Field Schema (for validation)
  FieldSchema,
  type FieldType,
  // Field Type
  FieldTypeSchema,
  type GroupField,
  GroupFieldSchema,
  hasNestedFields,
  isArrayField,
  isGroupField,
  isLayoutField,
  isNumberField,
  isRelationshipField,
  // Type Guards
  isTextField,
  type NumberField,
  NumberFieldSchema,
  type RelationshipField,
  RelationshipFieldSchema,
  type RowField,
  RowFieldSchema,
  type SelectField,
  SelectFieldSchema,
  type TabDefinition,
  // Tab Definition
  TabDefinitionSchema,
  type TabsField,
  TabsFieldSchema,
  type TextField,
  // Note: Field type is exported from contracts for consistency
  // Specific Field Types
  TextFieldSchema,
} from './field.js'

// =============================================================================
// Collection Contracts
// =============================================================================

export {
  type AuthConfig,
  // Auth Config
  AuthConfigSchema,
  // Version
  COLLECTION_SCHEMA_VERSION,
  type CollectionAccess,
  // Access
  CollectionAccessSchema,
  type CollectionAdminConfig,
  // Admin Config
  CollectionAdminConfigSchema,
  // Collection Config Schema (type is exported from contracts)
  CollectionConfigSchema,
  type CollectionHooks,
  // Hooks
  CollectionHooksSchema,
  type CollectionLabels,
  // Labels
  CollectionLabelsSchema,
  createAuthCollectionConfig,
  // Factory Functions
  createCollectionConfig,
  createUploadCollectionConfig,
  type SanitizedCollectionConfig,
  // Sanitized Config
  SanitizedCollectionConfigSchema,
  type UploadConfig,
  // Upload Config
  UploadConfigSchema,
  type VersionsConfig,
  // Versions Config
  VersionsConfigSchema,
} from './collection.js'

// =============================================================================
// Global Contracts
// =============================================================================

export {
  // Factory Functions
  createGlobalConfig,
  // Version
  GLOBAL_SCHEMA_VERSION,
  type GlobalAccess,
  // Access
  GlobalAccessSchema,
  type GlobalAdminConfig,
  // Admin Config
  GlobalAdminConfigSchema,
  // Global Config Schema (type is exported from contracts)
  GlobalConfigSchema,
  type GlobalHooks,
  // Hooks
  GlobalHooksSchema,
  type GlobalLabels,
  // Labels
  GlobalLabelsSchema,
  type GlobalVersionsConfig,
  // Versions Config
  GlobalVersionsConfigSchema,
  type SanitizedGlobalConfig,
  // Sanitized Config
  SanitizedGlobalConfigSchema,
} from './global.js'

// =============================================================================
// New Contracts (Hybrid Approach)
// =============================================================================

export {
  type AccessArgs,
  type AccessFunction,
  type AccessResult,
  type AfterChangeHookArgs,
  type AfterReadHookArgs,
  applyPluginExtensions,
  assertValidSlug,
  type BeforeChangeHookArgs,
  // Hook types
  type BeforeValidateHookArgs,
  type CollectionAccessConfig,
  type CollectionAfterChangeHook,
  type CollectionAfterReadHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeReadHook,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
  type CollectionHooksConfig,
  type CollectionStructure,
  CollectionStructureSchema,
  type Config,
  // Error handling
  ConfigValidationError,
  type CustomFieldTypeConfig,
  // Helpers
  defineCollection,
  defineField,
  defineGlobal,
  ExtendedFieldTypeSchema,
  // Combined types (unified Field type from contracts)
  type Field,
  type FieldAccess,
  type FieldAccessArgs,
  type FieldAccessFunction,
  type FieldHooksConfig as FieldHooksConfigNew,
  type FieldStructure,
  // Structure schemas
  FieldStructureSchema,
  // Validation
  type FieldValidateArgs,
  type FieldValidateFunction,
  fromCMSCollectionConfig,
  fromCMSGlobalConfig,
  type GlobalAccessConfig,
  type GlobalConfig,
  type GlobalHooksConfig,
  type GlobalStructure,
  GlobalStructureSchema,
  getCustomFieldType,
  getRevealUIExtensions,
  // RevealUI extensions
  hasRevealUIExtensions,
  isValidFieldType,
  isValidSlug,
  mergeCollectionConfigs,
  mergeFields,
  type PluginFieldExtension,
  // Function contracts (TypeScript-only)
  type RevealRequest,
  type RevealUICollectionConfig,
  type RevealUIExtensions,
  type RevealUIGlobalConfig,
  // Extensibility
  registerCustomFieldType,
  registerPluginExtension,
  type SanitizedConfig,
  safeValidate,
  type TypedCollectionConfig,
  type TypedGlobalConfig,
  // CMS compatibility
  toCMSCollectionConfig,
  toCMSConfig,
  toCMSGlobalConfig,
  toSlug,
  type ValidationResult,
  validateWithErrors,
  type Where,
} from './contracts/index.js'

// =============================================================================
// User Contracts
// =============================================================================

export {
  type CreateUserInput,
  // User Creation
  CreateUserInputSchema,
  createSession,
  createUser,
  type Session,
  // Session
  SessionSchema,
  type UpdateUserInput,
  // User Update
  UpdateUserInputSchema,
  type User,
  type UserPreferences,
  // User Preferences
  UserPreferencesSchema,
  type UserRole,
  UserRoleSchema,
  // User Schema
  UserSchema,
  type UserStatus,
  UserStatusSchema,
  type UserType,
  // User Types
  UserTypeSchema,
} from './user.js'
