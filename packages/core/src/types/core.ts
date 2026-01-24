/**
 * @revealui/core/types/core
 *
 * Core framework types only.
 * Use this subpath to import only framework types without schema types.
 */

// Re-export types from @revealui/core/types
// Using import-then-export pattern to ensure proper module resolution
import type {
  // Access Types
  Access,
  // API Types
  APIResponse,
  // Internal Types
  Block,
  BlocksField,
  CheckboxField,
  ClientCollectionConfig,
  ClientConfig,
  // Extension Types
  CustomComponent,
  // Runtime Types
  DatabaseAdapter,
  DatabaseResult,
  // Query Types
  Document,
  EndpointHandler,
  EndpointHandlerArgs,
  FieldAccess,
  FindArgs,
  // Config Types
  GlobalAfterChangeHook,
  JsonObject,
  OperationOptions,
  PaginatedDocs,
  // User Types
  Permission,
  // Plugin Types
  Plugin,
  PluginOptions,
  PopulateType,
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  RESTOptions,
  RelationshipMetadata,
  // Request Types
  RequestContext,
  RevealAfterChangeHook,
  RevealAfterReadHook,
  RevealBeforeChangeHook,
  RevealCollection,
  RevealCollectionConfig,
  RevealCollectionHooks,
  RevealConfig,
  RevealCreateOptions,
  RevealDataObject,
  RevealDeleteOptions,
  RevealDocument,
  RevealDocumentWithMeta,
  RevealFindOptions,
  RevealGlobal,
  RevealGlobalConfig,
  RevealHandler,
  RevealHookContext,
  RevealOperator,
  RevealPaginatedResult,
  RevealRequest,
  RevealSelect,
  RevealSort,
  RevealUI,
  RevealUIAccessArgs,
  RevealUIAccessContext,
  RevealUIAccessResult,
  RevealUIAccessRule,
  RevealUIBlock,
  RevealUICollectionConfig,
  RevealUIComponent,
  RevealUIContext,
  RevealUIDependencyCheckArgs,
  RevealUIEnhancedField,
  RevealUIField,
  // Hook Types
  RevealUIFieldHook,
  RevealUIFieldType,
  RevealUIFieldValidator,
  RevealUIFilterResult,
  RevealUIFrameworkContext,
  RevealUIHookContext,
  RevealUIInstance,
  RevealUILogger,
  RevealUIPermission,
  RevealUIRichTextAdapter,
  RevealUISchemaArgs,
  RevealUITenant,
  RevealUITraverseFieldsArgs,
  RevealUITraverseFieldsResult,
  RevealUIUser,
  RevealUIValidationRule,
  RevealUpdateOptions,
  RevealUser,
  RevealValue,
  RevealWhere,
  RevealWhereField,
  // Rich Text Types
  RichTextEditor,
  RichTextFeature,
  SelectMode,
  SelectType,
  StorageAdapter,
  TypedFallbackLocale,
  TypeWithID,
  User,
  WhereClause,
} from './index.js'

import { RevealOperators } from './index.js'

// Re-export all types
export type {
  // Query Types
  Document,
  JsonObject,
  PopulateType,
  RelationshipMetadata,
  RevealDataObject,
  RevealDocument,
  RevealDocumentWithMeta,
  RevealOperator,
  RevealSelect,
  RevealSort,
  RevealValue,
  RevealWhere,
  RevealWhereField,
  SelectMode,
  SelectType,
  TypedFallbackLocale,
  TypeWithID,
  WhereClause,
  // User Types
  Permission,
  RevealUIPermission,
  RevealUITenant,
  RevealUIUser,
  RevealUser,
  // User - exported from schema.ts instead
  // Request Types
  RequestContext,
  // RevealRequest - exported from schema.ts instead
  // Runtime Types
  DatabaseAdapter,
  DatabaseResult,
  FindArgs,
  OperationOptions,
  PaginatedDocs,
  RevealCollection,
  RevealCreateOptions,
  RevealDeleteOptions,
  RevealFindOptions,
  RevealGlobal,
  RevealPaginatedResult,
  RevealUI,
  RevealUIInstance,
  RevealUILogger,
  RevealUpdateOptions,
  StorageAdapter,
  // Config Types
  GlobalAfterChangeHook,
  RevealAfterChangeHook,
  RevealAfterReadHook,
  RevealBeforeChangeHook,
  RevealCollectionConfig,
  RevealCollectionHooks,
  RevealConfig,
  RevealGlobalConfig,
  RevealHookContext,
  // Hook Types
  RevealUIFieldHook,
  RevealUIFieldValidator,
  RevealUIHookContext,
  RevealUIValidationRule,
  // Access Types
  Access,
  FieldAccess,
  RevealUIAccessArgs,
  RevealUIAccessContext,
  RevealUIAccessResult,
  RevealUIAccessRule,
  RevealUIFilterResult,
  // API Types
  APIResponse,
  EndpointHandler,
  EndpointHandlerArgs,
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  RESTOptions,
  RevealHandler,
  // Rich Text Types
  RichTextEditor,
  RichTextFeature,
  // Plugin Types
  Plugin,
  PluginOptions,
  // Extension Types
  CustomComponent,
  // RevealUICollectionConfig - exported from schema.ts instead
  RevealUIComponent,
  RevealUIContext,
  RevealUIEnhancedField,
  RevealUIField,
  RevealUIFieldType,
  RevealUIFrameworkContext,
  // Internal Types
  // Block - exported from schema.ts instead (contract type)
  BlocksField,
  CheckboxField,
  ClientCollectionConfig,
  ClientConfig,
  RevealUIBlock,
  RevealUIDependencyCheckArgs,
  RevealUIRichTextAdapter,
  RevealUISchemaArgs,
  RevealUITraverseFieldsArgs,
  RevealUITraverseFieldsResult,
}

// Re-export values (non-type exports)
export { RevealOperators }
