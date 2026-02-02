/**
 * @revealui/contracts
 *
 * Unified contracts package for RevealUI - schemas, validation, and type safety across the stack
 *
 * ## Overview
 *
 * This package provides a unified contract system that combines:
 * - Runtime validation using Zod schemas
 * - TypeScript types derived from schemas
 * - Dual representation (human/agent) for entities
 * - Database contract bridges for type-safe DB operations
 * - Action validation against entity constraints
 *
 * ## Package Exports
 *
 * - `@revealui/contracts` - Everything
 * - `@revealui/contracts/foundation` - Core Contract<T> interface
 * - `@revealui/contracts/representation` - Dual representation types
 * - `@revealui/contracts/entities` - User, Site, Page contracts
 * - `@revealui/contracts/content` - Block contracts
 * - `@revealui/contracts/cms` - CMS configuration contracts
 * - `@revealui/contracts/agents` - Agent memory/context contracts
 * - `@revealui/contracts/database` - DB ↔ Contract bridges
 * - `@revealui/contracts/actions` - Action validation
 * - `@revealui/contracts/utilities` - Shared utilities
 *
 * @packageDocumentation
 */

// Re-export zod for consumers
export { z } from 'zod/v4'

// =============================================================================
// Foundation
// =============================================================================

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
} from './foundation/index.js'

// =============================================================================
// Representation Layer (Human + Agent)
// =============================================================================

export {
  type AgentActionDefinition,
  AgentActionDefinitionSchema,
  type AgentConstraint,
  AgentConstraintSchema,
  type AgentRelation,
  AgentRelationSchema,
  type AgentRepresentation,
  AgentRepresentationSchema,
  createEmbedding,
  createTimestamps,
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  type DualEntity,
  DualEntitySchema,
  EMBEDDING_DIMENSIONS,
  type Embedding,
  type EmbeddingModel,
  EmbeddingSchema,
  type HumanRepresentation,
  HumanRepresentationSchema,
  incrementVersion,
  REPRESENTATION_SCHEMA_VERSION,
  toAgentRepresentation,
  toHumanRepresentation,
  updateTimestamp,
} from './representation/index.js'

// =============================================================================
// Core Entities
// =============================================================================

export {
  type CreatePageInput,
  CreatePageInputSchema,
  computePagePath,
  createPage,
  createPageLock,
  estimateWordCount,
  getPageBreadcrumbs,
  isLockedByUser,
  isPageLocked,
  PAGE_SCHEMA_VERSION,
  type Page,
  type PageLock,
  PageLockSchema,
  PageSchema,
  type PageSeo,
  PageSeoSchema,
  type PageStatus,
  PageStatusSchema,
  type UpdatePageInput,
  UpdatePageInputSchema,
} from './entities/page.js'

export {
  type CreateSiteInput,
  CreateSiteInputSchema,
  canAgentEditSite,
  canUserPerformAction,
  createSite,
  SITE_SCHEMA_VERSION,
  type Site,
  type SiteCollaborator,
  SiteCollaboratorSchema,
  SiteSchema,
  type SiteSeo,
  SiteSeoSchema,
  type SiteSettings,
  SiteSettingsSchema,
  type SiteStatus,
  SiteStatusSchema,
  type SiteTheme,
  SiteThemeSchema,
  type UpdateSiteInput,
  UpdateSiteInputSchema,
} from './entities/site.js'

export {
  type CreateUserInput,
  CreateUserInputSchema,
  createSession,
  createUser,
  type Session,
  SessionSchema,
  type UpdateUserInput,
  UpdateUserInputSchema,
  USER_SCHEMA_VERSION,
  type User,
  type UserPreferences,
  UserPreferencesSchema,
  type UserRole,
  UserRoleSchema,
  UserSchema,
  type UserStatus,
  UserStatusSchema,
  type UserType,
  UserTypeSchema,
} from './entities/user.js'

// =============================================================================
// Content Blocks
// =============================================================================

export {
  type AccordionBlock,
  AccordionBlockSchema,
  BLOCK_SCHEMA_VERSION,
  type Block,
  type BlockMeta,
  BlockMetaSchema,
  BlockSchema,
  type BlockStyle,
  BlockStyleSchema,
  type BlockType,
  BlockTypes,
  type ButtonBlock,
  ButtonBlockSchema,
  type CodeBlock,
  CodeBlockSchema,
  type ColumnsBlock,
  ColumnsBlockSchema,
  type ComponentBlock,
  ComponentBlockSchema,
  countBlocks,
  createCodeBlock,
  createHeadingBlock,
  createImageBlock,
  createTextBlock,
  type DividerBlock,
  DividerBlockSchema,
  type EmbedBlock,
  EmbedBlockSchema,
  type FormBlock,
  FormBlockSchema,
  findBlockById,
  type GridBlock,
  GridBlockSchema,
  type HeadingBlock,
  HeadingBlockSchema,
  type HtmlBlock,
  HtmlBlockSchema,
  type ImageBlock,
  ImageBlockSchema,
  isColumnsBlock,
  isContainerBlock,
  isGridBlock,
  isHeadingBlock,
  isImageBlock,
  isTextBlock,
  type ListBlock,
  ListBlockSchema,
  type QuoteBlock,
  QuoteBlockSchema,
  type SpacerBlock,
  SpacerBlockSchema,
  type TableBlock,
  TableBlockSchema,
  type TabsBlock,
  TabsBlockSchema,
  type TextBlock,
  TextBlockSchema,
  type VideoBlock,
  VideoBlockSchema,
  walkBlocks,
} from './content/index.js'

// =============================================================================
// Agents
// =============================================================================

export {
  AGENT_SCHEMA_VERSION,
  type AgentActionRecord,
  AgentActionRecordSchema,
  type AgentContext,
  AgentContextSchema,
  type AgentDefinition,
  AgentDefinitionSchema,
  type AgentMemory,
  AgentMemorySchema,
  type AgentState,
  AgentStateSchema,
  type Conversation,
  type ConversationMessage,
  ConversationMessageSchema,
  ConversationSchema,
  createAgentContext,
  createAgentMemory,
  createConversation,
  createMessage,
  type Intent,
  IntentSchema,
  type IntentType,
  IntentTypeSchema,
  type MemorySource,
  MemorySourceSchema,
  type MemoryType,
  MemoryTypeSchema,
  type ToolDefinition,
  ToolDefinitionSchema,
  type ToolParameter,
  ToolParameterSchema,
} from './agents/index.js'

// =============================================================================
// CMS Contracts
// =============================================================================

export {
  CollectionContract,
  type CollectionContractType,
  isCollectionConfig,
  parseCollection,
  validateCollection,
} from './cms/collection.js'
export {
  type CollectionConfig,
  type Config,
  defineCollection,
  defineField,
  defineGlobal,
  type Field,
  type GlobalConfig,
  type SanitizedConfig,
  type TypedCollectionConfig,
  type TypedGlobalConfig,
} from './cms/config.js'
export {
  ConfigContract,
  type ConfigContractType,
  isConfigStructure,
  parseConfigStructure,
  validateConfigStructure,
} from './cms/config-contract.js'

export {
  ConfigValidationError,
  safeValidate,
  type ValidationResult,
  validateWithErrors,
} from './cms/errors.js'

// Re-export all CMS contracts from the main CMS index
export * from './cms/index.js'

// =============================================================================
// Database Bridges
// =============================================================================

export {
  batchContractToDbInsert,
  batchDbRowsToContract,
  type ContractToDrizzleInsert,
  contractToDbInsert,
  createContractToDbMapper,
  createDbRowMapper,
  createTableContractRegistry,
  DatabaseContractRegistry,
  type DrizzleToContract,
  databaseContractRegistry,
  dbRowToContract,
  isDbRowAndContract,
  isDbRowMatchingContract,
  safeDbRowToContract,
  type TableContractMap,
  type TableInsertType,
  type TableName,
  type TableRowType,
  type TableUpdateType,
} from './database/index.js'

// =============================================================================
// Generated Database Types
// =============================================================================

export type {
  AgentActionsInsert,
  // Agent tables
  AgentActionsRow,
  AgentActionsUpdate,
  AgentContextsInsert,
  AgentContextsRow,
  AgentContextsUpdate,
  AgentMemoriesInsert,
  AgentMemoriesRow,
  AgentMemoriesUpdate,
  ConversationsInsert,
  ConversationsRow,
  ConversationsUpdate,
  CrdtOperationsInsert,
  // CRDT tables
  CrdtOperationsRow,
  CrdtOperationsUpdate,
  Database,
  DatabaseInsert,
  DatabaseRow,
  DatabaseUpdate,
  FailedAttemptsInsert,
  // Security tables
  FailedAttemptsRow,
  FailedAttemptsUpdate,
  GlobalFooterInsert,
  // CMS tables
  GlobalFooterRow,
  GlobalFooterUpdate,
  GlobalHeaderInsert,
  GlobalHeaderRow,
  GlobalHeaderUpdate,
  GlobalSettingsInsert,
  GlobalSettingsRow,
  GlobalSettingsUpdate,
  MediaInsert,
  MediaRow,
  MediaUpdate,
  NodeIdMappingsInsert,
  NodeIdMappingsRow,
  NodeIdMappingsUpdate,
  PageRevisionsInsert,
  PageRevisionsRow,
  PageRevisionsUpdate,
  PagesInsert,
  PagesRow,
  PagesUpdate,
  PostsInsert,
  PostsRow,
  PostsUpdate,
  RateLimitsInsert,
  RateLimitsRow,
  RateLimitsUpdate,
  SessionsInsert,
  SessionsRow,
  SessionsUpdate,
  SiteCollaboratorsInsert,
  SiteCollaboratorsRow,
  SiteCollaboratorsUpdate,
  SitesInsert,
  // Site management
  SitesRow,
  SitesUpdate,
  // TableName,
  UsersInsert,
  UsersRow,
  UsersUpdate,
} from './generated/database.js'

// =============================================================================
// API Contracts
// =============================================================================

export {
  type PasswordResetRequest,
  PasswordResetRequestContract,
  PasswordResetRequestSchema,
  type PasswordResetToken,
  PasswordResetTokenContract,
  PasswordResetTokenSchema,
  type SignInRequest,
  SignInRequestContract,
  SignInRequestSchema,
  type SignUpRequest,
  SignUpRequestContract,
  SignUpRequestSchema,
} from './api/auth.js'

// =============================================================================
// Actions
// =============================================================================

export {
  type ActionValidationContext,
  type ActionValidationError,
  type ActionValidationFailure,
  type ActionValidationResult,
  type ActionValidationSuccess,
  validateAction,
} from './actions/index.js'
