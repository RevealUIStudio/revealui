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
export { type AccessArgs, type AccessFunction, type AccessResult, type AfterChangeHookArgs, type AfterReadHookArgs, type ArrayField, ArrayFieldSchema, type AuthConfig, AuthConfigSchema, applyPluginExtensions, assertValidSlug, type BeforeChangeHookArgs, COLLECTION_SCHEMA_VERSION, type CollectionAccess, type CollectionAccessConfig, CollectionAccessSchema, type CollectionAdminConfig, CollectionAdminConfigSchema, type CollectionAfterChangeHook, type CollectionAfterReadHook, type CollectionBeforeChangeHook, type CollectionBeforeReadHook, type CollectionBeforeValidateHook, type CollectionConfig, CollectionConfigSchema, type CollectionHooks, type CollectionHooksConfig, CollectionHooksSchema, type CollectionLabels, CollectionLabelsSchema, type CollectionStructure, CollectionStructureSchema, type Config, ConfigValidationError, type CustomFieldTypeConfig, createAuthCollectionConfig, createCollectionConfig, createGlobalConfig, createUploadCollectionConfig, defineCollection, defineField, defineGlobal, ExtendedFieldTypeSchema, FIELD_SCHEMA_VERSION, type Field, type FieldAccess as SchemaFieldAccess, type FieldAccessArgs, type FieldAccessConfig, FieldAccessConfigSchema, type FieldAccessFunction, type FieldAdminConfig, FieldAdminConfigSchema, type FieldHooksConfig, FieldHooksConfigSchema, type FieldOption, FieldOptionSchema, FieldSchema, type FieldStructure, FieldStructureSchema, type FieldType, FieldTypeSchema, type FieldValidateArgs, fromCMSCollectionConfig, fromCMSGlobalConfig, GLOBAL_SCHEMA_VERSION, type GlobalAccess, type GlobalAccessConfig, GlobalAccessSchema, type GlobalAdminConfig, GlobalAdminConfigSchema, type GlobalConfig, GlobalConfigSchema, type GlobalHooks, type GlobalHooksConfig, GlobalHooksSchema, type GlobalLabels, GlobalLabelsSchema, type GlobalStructure, GlobalStructureSchema, type GlobalVersionsConfig, GlobalVersionsConfigSchema, type GroupField, GroupFieldSchema, getCustomFieldType, getRevealUIExtensions, hasNestedFields, hasRevealUIExtensions, isArrayField, isGroupField, isLayoutField, isNumberField, isRelationshipField, isTextField, isValidFieldType, isValidSlug, mergeCollectionConfigs, mergeFields, type NumberField, NumberFieldSchema, type PluginFieldExtension, type RelationshipField, RelationshipFieldSchema, type RevealUICollectionConfig as SchemaRevealUICollectionConfig, type RevealUIExtensions, type RevealUIGlobalConfig as SchemaRevealUIGlobalConfig, type RowField, RowFieldSchema, registerCustomFieldType, registerPluginExtension, type SanitizedCollectionConfig, SanitizedCollectionConfigSchema, type SanitizedConfig, type SanitizedGlobalConfig, SanitizedGlobalConfigSchema, type SelectField, SelectFieldSchema, safeValidate, type TabDefinition, TabDefinitionSchema, type TabsField, TabsFieldSchema, type TextField, TextFieldSchema, toCMSCollectionConfig, toCMSGlobalConfig, toSlug, type UploadConfig, UploadConfigSchema, type ValidationResult, type VersionConfig, VersionsConfigSchema, validateWithErrors, type Where, } from '@revealui/contracts/cms';
export { type Document, type JsonObject, type PopulateType, type RelationshipMetadata, type RevealDataObject, type RevealDocument, type RevealDocumentWithMeta, type RevealOperator, RevealOperators, type RevealSelect, type RevealSort, type RevealValue, type RevealWhere, type RevealWhereField, type SelectMode, type SelectType, type TypedFallbackLocale, type TypeWithID, type WhereClause, } from './query.js';
export type { Permission, RevealUIPermission, RevealUITenant, RevealUIUser, RevealUser, User, } from './user.js';
export type { RequestContext, RevealRequest, } from './request.js';
export type { DatabaseAdapter, DatabaseResult, FindArgs, OperationOptions, PaginatedDocs, RevealCollection, RevealCreateOptions, RevealDeleteOptions, RevealFindOptions, RevealGlobal, RevealPaginatedResult, RevealUI, RevealUIInstance, RevealUILogger, RevealUpdateOptions, StorageAdapter, } from './runtime.js';
export type { GlobalAfterChangeHook, RevealAfterChangeHook, RevealAfterReadHook, RevealBeforeChangeHook, RevealCollectionConfig, RevealCollectionHooks, RevealConfig, RevealGlobalConfig, RevealHookContext, } from './config.js';
export type { RevealUIFieldHook, RevealUIFieldValidator, RevealUIHookContext, RevealUIValidationRule, } from './hooks.js';
export type { Access, FieldAccess, RevealUIAccessArgs, RevealUIAccessContext, RevealUIAccessResult, RevealUIAccessRule, RevealUIFilterResult, } from './access.js';
export type { APIResponse, EndpointHandler, EndpointHandlerArgs, REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST, RESTOptions, RevealHandler, } from './api.js';
export type { RichTextEditor, RichTextFeature, } from './richtext.js';
export type { Plugin, PluginOptions, } from './plugins.js';
export type { CustomComponent, RevealUICollectionConfig, RevealUIComponent, RevealUIContext, RevealUIEnhancedField, RevealUIField, RevealUIFieldType, RevealUIFrameworkContext, } from './extensions.js';
export type { Block, BlocksField, CheckboxField, ClientCollectionConfig, ClientConfig, RevealUIBlock, RevealUIDependencyCheckArgs, RevealUIRichTextAdapter, RevealUISchemaArgs, RevealUITraverseFieldsArgs, RevealUITraverseFieldsResult, } from './legacy.js';
export type { JobsConfig, JobTask, JobTaskPriority, JobTaskStatus, JobWorkflow, WorkflowStep, } from './jobs.js';
export interface VectorDocument {
    id: string;
    content: string;
    embedding: number[];
    metadata: {
        type: 'post' | 'comment' | 'memory';
        sourceId: string;
        authorId: string;
        timestamp: Date;
        tags: string[];
    };
}
//# sourceMappingURL=index.d.ts.map