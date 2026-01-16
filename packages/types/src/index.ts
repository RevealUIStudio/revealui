/**
 * @revealui/types
 *
 * Unified type exports for RevealUI framework.
 * This package provides a single entry point for all RevealUI types.
 *
 * ## Usage
 *
 * ```typescript
 * // Import all types
 * import type { Config, CollectionConfig, Field } from '@revealui/types'
 *
 * // Import specific type categories
 * import type { RevealUIInstance, RevealCollection } from '@revealui/types/core'
 * import type { Page, User, Site } from '@revealui/types/schema'
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// CORE FRAMEWORK TYPES
// =============================================================================
// Re-export all types from @revealui/core/types

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
  RevealOperators,
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
  User as RevealUserType,
  // Request Types
  RequestContext,
  RevealRequest as RevealRequestType,
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
  FieldAccess as RevealFieldAccess,
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
  RevealUICollectionConfig,
  RevealUIComponent,
  RevealUIContext,
  RevealUIEnhancedField,
  RevealUIField,
  RevealUIFieldType,
  RevealUIFrameworkContext,
  // Internal Types
  Block as RevealBlock,
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
} from '@revealui/core/types'

// =============================================================================
// SCHEMA CONTRACT TYPES
// =============================================================================
// Re-export all types from @revealui/schema/core (contracts)

export type {
  // Core Contracts - from @revealui/schema/core
  AccessArgs,
  AccessFunction,
  AccessResult,
  AfterChangeHookArgs,
  AfterReadHookArgs,
  ArrayField,
  AuthConfig,
  BeforeChangeHookArgs,
  BeforeValidateHookArgs,
  CollectionAccess,
  CollectionAccessConfig,
  CollectionAdminConfig,
  CollectionAfterChangeHook,
  CollectionAfterReadHook,
  CollectionBeforeChangeHook,
  CollectionBeforeReadHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  CollectionHooks,
  CollectionHooksConfig,
  CollectionLabels,
  CollectionStructure,
  Config,
  CustomFieldTypeConfig,
  Field,
  FieldAccess as SchemaFieldAccess,
  FieldAccessArgs,
  FieldAccessConfig,
  FieldAccessFunction,
  FieldAdminConfig,
  FieldHooksConfig,
  FieldOption,
  FieldStructure,
  FieldType,
  FieldValidateArgs,
  FieldValidateFunction,
  GlobalAccess,
  GlobalAccessConfig,
  GlobalAdminConfig,
  GlobalConfig,
  GlobalHooks,
  GlobalHooksConfig,
  GlobalLabels,
  GlobalStructure,
  GlobalVersionsConfig,
  GroupField,
  NumberField,
  PluginFieldExtension,
  RelationshipField,
  RevealRequest as SchemaRevealRequest,
  RevealUICollectionConfig as SchemaRevealUICollectionConfig,
  RevealUIExtensions,
  RevealUIGlobalConfig as SchemaRevealUIGlobalConfig,
  RowField,
  SanitizedCollectionConfig,
  SanitizedConfig,
  SanitizedGlobalConfig,
  SelectField,
  TabDefinition,
  TabsField,
  TextField,
  TypedCollectionConfig,
  TypedGlobalConfig,
  UploadConfig,
  ValidationResult,
  VersionsConfig,
  Where,
  // User Contracts
  CreateUserInput,
  Session,
  UpdateUserInput,
  User as SchemaUser,
  UserPreferences,
  UserRole,
  UserStatus,
  UserType,
} from '@revealui/schema/core'

// =============================================================================
// SCHEMA ENTITY TYPES (Page, Site, Block, Agent, Representation)
// =============================================================================
// These are exported from the main @revealui/schema package, not /core

export type {
  // Agent Contracts
  AgentActionRecord,
  AgentContext,
  AgentDefinition,
  AgentMemory,
  AgentState,
  Conversation,
  ConversationMessage,
  Intent,
  IntentType,
  MemorySource,
  MemoryType,
  ToolDefinition,
  ToolParameter,
  // Agent Representation
  AgentActionDefinition,
  AgentConstraint,
  AgentRelation,
  AgentRepresentation,
  // Representation Contracts
  DualEntity,
  Embedding,
  EmbeddingModel,
  HumanRepresentation,
  // Page Contracts
  CreatePageInput,
  Page,
  PageLock,
  PageSeo,
  PageStatus,
  UpdatePageInput,
  // Site Contracts
  CreateSiteInput,
  Site,
  SiteCollaborator,
  SiteSeo,
  SiteSettings,
  SiteStatus,
  SiteTheme,
  UpdateSiteInput,
  // Block Contracts
  AccordionBlock,
  Block,
  BlockMeta,
  BlockStyle,
  BlockType,
  ButtonBlock,
  CodeBlock,
  ColumnsBlock,
  ComponentBlock,
  DividerBlock,
  EmbedBlock,
  FormBlock,
  GridBlock,
  HeadingBlock,
  HtmlBlock,
  ImageBlock,
  ListBlock,
  QuoteBlock,
  SpacerBlock,
  TableBlock,
  TabsBlock,
  TextBlock,
  VideoBlock,
} from '@revealui/schema'

// =============================================================================
// FRONTEND TYPES
// =============================================================================
// Types used by the frontend web app

export type {
  Config as FrontendConfig,
  OnPageTransitionEndAsync,
  OnPageTransitionStartAsync,
  PageContext,
  PageContextInit,
} from './frontend'

// =============================================================================
// GENERATED TYPES
// =============================================================================
// Re-export generated types from centralized location

export type { GeneratedConfig, GeneratedTypes, Database } from './generated'
export type { Config as CMSConfig } from './cms'
