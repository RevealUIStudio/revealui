// RevealUI CMS - Core functionality
export { buildConfig } from './config/index.js';
export { getPayload, getRevealUI } from './config/runtime.js';

// Re-export RevealUI types (new abstractions)
export type {
  Access,
  AccessArgs,
  AccessResult,
  SanitizedConfig,
  ClientConfig,
  ClientCollectionConfig,
  ClientGlobalConfig,
  AdminConfig,
  DatabaseConfig,
  UploadConfig,
  TypeScriptConfig,
  AuthConfig,
  AuthStrategy,
  AuthResult,
  VersionConfig,
  TimestampConfig,
  LabelConfig,
  Endpoint,
  FileData,
  FileSizeImproved,
  TypeWithID,
  DefaultDocumentIDType,
  TypedUser,
  TypedLocale,
  TypedFallbackLocale,
  Operation,
  RequestContext,
  Validate,
  ValidateOptions,
  LabelFunction,
  createDataloaderCacheKey,
  createLocalReq,
  isValidID,
  fieldsToJSONSchema,
  flattenAllFields,
  ImportMapGenerators,
  DataFromCollectionSlug,
  DocumentPreferences,
  FlattenedField,
  FlattenedBlock,
  FlattenedBlocksField,
  DefaultServerCellComponentProps,
  RevealConfig,
  RevealCollectionConfig,
  RevealGlobalConfig,
  RevealField,
  RevealUser,
  RevealPayload,
  RevealRequest,
  RevealDocument,
  RevealAfterChangeHook,
  RevealAfterReadHook,
  RevealCollectionHooks,
  RevealUIGlobalHook,
  RevealOperator,
  Permission,
  RevealValue,
  RevealWhere,
  RevealSort,
  RevealSelect,
  RevealFindOptions,
  RevealCreateOptions,
  RevealUpdateOptions,
  RevealDeleteOptions,
  RevealPaginatedResult,
  RevealDocumentWithMeta,
  RevealDataObject,
  RevealHookContext,
} from './types/index';

// Legacy Payload-compatible exports (for backward compatibility)
export type {
  RevealConfig as Config,
  RevealCollectionConfig as CollectionConfig,
  RevealGlobalConfig as GlobalConfig,
  RevealField as Field,
  RevealUser as User,
  RevealPayload as Payload,
  RevealRequest as PayloadRequest,
  RevealDocument as Document,
  RevealAfterChangeHook as CollectionAfterChangeHook,
  RevealAfterReadHook as CollectionAfterReadHook,
  RevealCollectionHooks as CollectionHooks,
  RevealUIGlobalHook as GlobalHooks,
  PayloadComponent,
} from './types/index';

// REST API
export { handleRESTRequest, createRESTHandlers } from './api/rest';
export type { APIResponse, RESTOptions } from './api/rest';

// Database adapters
export { sqliteAdapter } from './database/sqlite';
export { postgresAdapter } from './database/postgres';

// Storage adapters
export { vercelBlobStorage } from './storage/vercel-blob';

// Auth utilities
export { authenticated, anyone } from './auth/access';

// Rich text editor
export { lexicalEditor } from './richtext/lexical';

// Plugins
export { formBuilderPlugin } from './plugins/form-builder';
export { nestedDocsPlugin } from './plugins/nested-docs';
export { redirectsPlugin } from './plugins/redirects';

// Admin utilities
export { en } from './admin/i18n/en';

// Next.js integration
export { withRevealUI } from './nextjs/index';
export { getRevealUI as getRevealUINext } from './nextjs/index';

// Utilities
export { deepMerge } from './config/utils';
export { getRelationshipFields, validateRelationshipMetadata } from './utils/relationshipAnalyzer';

// Payload utility functions (for richtext-lexical compatibility)
export {
  afterChangeTraverseFields,
  afterReadTraverseFields,
  beforeChangeTraverseFields,
  beforeValidateTraverseFields,
  checkDependencies,
  deepMergeSimple,
  type RichTextAdapter,
  withNullableJSONSchemaType,
} from './core/payload';

// Framework API
export { RevealUI, createRevealUI, createRevealUICollection, createRevealUIField, createRevealUIBlock, useRevealUI, withRevealUIAccess } from './api';
export type { RevealUITenant, RevealUIContext, RevealUIAccessResult, RevealUICollectionConfig, RevealUIField, PayloadHandler, RevealUIAccessArgs, RevealUIComponent, RevealUITextField, RevealUIBlock, RevealUICollection, RelationshipMetadata } from './types/index';
