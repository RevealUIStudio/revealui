/**
 * RevealUI CMS Framework - Type System
 *
 * This module consolidates the CMS type system using @revealui/contracts
 * as the single source of truth, while extending with RevealUI-specific features.
 *
 * ## Architecture
 *
 * 1. **Contracts** (@revealui/contracts/cms)
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
export { ArrayFieldSchema, AuthConfigSchema, applyPluginExtensions, assertValidSlug, 
// Collection contracts
COLLECTION_SCHEMA_VERSION, CollectionAccessSchema, CollectionAdminConfigSchema, CollectionConfigSchema, CollectionHooksSchema, CollectionLabelsSchema, CollectionStructureSchema, 
// ==========================================================================
// HYBRID CONTRACTS
// ==========================================================================
// Error handling
ConfigValidationError, createAuthCollectionConfig, 
// Collection factories
createCollectionConfig, 
// Global factories
createGlobalConfig, createUploadCollectionConfig, 
// Config helpers
defineCollection, defineField, defineGlobal, ExtendedFieldTypeSchema, 
// Field contracts
FIELD_SCHEMA_VERSION, FieldAccessConfigSchema, FieldAdminConfigSchema, FieldHooksConfigSchema, FieldOptionSchema, FieldSchema, 
// Structure schemas (Zod - runtime validation)
FieldStructureSchema, FieldTypeSchema, 
// Validation contracts
// type FieldValidateFunction,
fromCMSCollectionConfig, fromCMSGlobalConfig, 
// Global contracts
GLOBAL_SCHEMA_VERSION, GlobalAccessSchema, GlobalAdminConfigSchema, GlobalConfigSchema, GlobalHooksSchema, GlobalLabelsSchema, GlobalStructureSchema, GlobalVersionsConfigSchema, GroupFieldSchema, getCustomFieldType, getRevealUIExtensions, hasNestedFields, 
// RevealUI extensions
hasRevealUIExtensions, isArrayField, isGroupField, isLayoutField, isNumberField, isRelationshipField, 
// Field type guards
isTextField, isValidFieldType, isValidSlug, mergeCollectionConfigs, mergeFields, NumberFieldSchema, RelationshipFieldSchema, RowFieldSchema, 
// Extensibility
registerCustomFieldType, registerPluginExtension, SanitizedCollectionConfigSchema, SanitizedGlobalConfigSchema, SelectFieldSchema, safeValidate, TabDefinitionSchema, TabsFieldSchema, TextFieldSchema, 
// CMS compatibility
toCMSCollectionConfig, toCMSGlobalConfig, toSlug, UploadConfigSchema, VersionsConfigSchema, validateWithErrors, } from '@revealui/contracts/cms';
// =============================================================================
// QUERY TYPES
// =============================================================================
export { RevealOperators, } from './query.js';
