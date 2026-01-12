/**
 * @revealui/schema
 *
 * The contract layer for RevealUI - defining the shared language between
 * humans and AI agents.
 *
 * ## Overview
 *
 * This package defines the schemas for all entities in RevealUI. Every entity
 * has a dual representation:
 *
 * 1. **Human Representation**: Visual labels, descriptions, icons, and natural
 *    language suggestions. Used by the UI to display entities to humans.
 *
 * 2. **Agent Representation**: Structured metadata including semantic types,
 *    embeddings, constraints, and available actions. Used by AI agents to
 *    reason about and manipulate entities.
 *
 * ## Important Notes
 *
 * ### Agent Representations are Metadata, Not Enforcement
 *
 * The `agent` field on entities describes HOW agents SHOULD interact with them,
 * but this package does NOT enforce these constraints. Enforcement happens in:
 *
 * - `@revealui/actions`: Server Actions that validate agent permissions
 * - `@revealui/ai`: AI runtime that respects tool definitions and constraints
 *
 * This separation allows the schema to be used independently for validation
 * while keeping runtime logic in appropriate packages.
 *
 * ### Schema Versioning
 *
 * All entities include version fields for migration support:
 *
 * - `version`: Representation schema version (from DualEntitySchema)
 * - `schemaVersion`: Entity-specific schema version
 *
 * When making breaking changes to schemas, increment these versions and
 * provide migration logic in `@revealui/db`.
 *
 * ### Embedding Validation
 *
 * Embeddings are validated against known model dimensions. Use the
 * `createEmbedding()` helper to ensure vectors match their model's
 * expected dimension.
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   PageSchema,
 *   createPage,
 *   BlockSchema,
 *   createTextBlock,
 *   type Page,
 *   type Block,
 * } from '@revealui/schema'
 *
 * // Validate incoming data
 * const page = PageSchema.parse(rawData)
 *
 * // Create new entities with proper dual representation
 * const newPage = createPage('page-123', {
 *   siteId: 'site-456',
 *   title: 'Hello World',
 *   slug: 'hello-world',
 * })
 *
 * // Create blocks with factory functions
 * const textBlock = createTextBlock('block-1', '# Hello\n\nWelcome!')
 * ```
 *
 * ## Package Exports
 *
 * - `@revealui/schema` - Everything
 * - `@revealui/schema/core` - User, Site, Page schemas
 * - `@revealui/schema/blocks` - Block schemas and utilities
 * - `@revealui/schema/agents` - Agent context, memory, and conversation schemas
 * - `@revealui/schema/representation` - Dual representation types and utilities
 *
 * @packageDocumentation
 */

// Re-export zod for consumers
export { z } from 'zod'

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
  // Agent Representation
  AgentRepresentationSchema,
  createEmbedding,
  createTimestamps,
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  type DualEntity,
  // Dual Entity
  DualEntitySchema,
  // Embedding
  EMBEDDING_DIMENSIONS,
  type Embedding,
  type EmbeddingModel,
  EmbeddingSchema,
  type HumanRepresentation,
  // Human Representation
  HumanRepresentationSchema,
  incrementVersion,
  // Version
  REPRESENTATION_SCHEMA_VERSION,
  toAgentRepresentation,
  // Utilities
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
  // Page
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
} from './core/page.js'

export {
  type CreateSiteInput,
  CreateSiteInputSchema,
  canAgentEditSite,
  canUserPerformAction,
  createSite,
  // Site
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
} from './core/site.js'
export {
  type CreateUserInput,
  CreateUserInputSchema,
  createSession,
  createUser,
  type Session,
  // Session
  SessionSchema,
  type UpdateUserInput,
  UpdateUserInputSchema,
  // User
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
} from './core/user.js'

// =============================================================================
// Blocks
// =============================================================================

export {
  type AccordionBlock,
  AccordionBlockSchema,
  // Version
  BLOCK_SCHEMA_VERSION,
  type Block,
  type BlockMeta,
  BlockMetaSchema,
  // Union Schema
  BlockSchema,
  type BlockStyle,
  // Style & Meta
  BlockStyleSchema,
  type BlockType,
  // Block Types
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
  // Factories
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
  // Type Guards
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
  // Individual Block Schemas
  TextBlockSchema,
  type VideoBlock,
  VideoBlockSchema,
  // Utilities
  walkBlocks,
} from './blocks/index.js'

// =============================================================================
// Agents
// =============================================================================

export {
  // Version
  AGENT_SCHEMA_VERSION,
  type AgentActionRecord,
  // Actions
  AgentActionRecordSchema,
  type AgentContext,
  // Context
  AgentContextSchema,
  type AgentDefinition,
  // Agent Definition
  AgentDefinitionSchema,
  type AgentMemory,
  AgentMemorySchema,
  type AgentState,
  // Agent State
  AgentStateSchema,
  type Conversation,
  type ConversationMessage,
  // Conversation
  ConversationMessageSchema,
  ConversationSchema,
  createAgentContext,
  createAgentMemory,
  createConversation,
  createMessage,
  type Intent,
  IntentSchema,
  type IntentType,
  // Intent
  IntentTypeSchema,
  type MemorySource,
  MemorySourceSchema,
  type MemoryType,
  // Memory
  MemoryTypeSchema,
  type ToolDefinition,
  ToolDefinitionSchema,
  type ToolParameter,
  // Tools
  ToolParameterSchema,
} from './agents/index.js'

// =============================================================================
// Core Contracts
// =============================================================================

export {
  type ArrayField,
  ArrayFieldSchema,
  type AuthConfig,
  AuthConfigSchema,
  // Collection Contracts
  COLLECTION_SCHEMA_VERSION,
  type CollectionAccess,
  CollectionAccessSchema,
  type CollectionAdminConfig,
  CollectionAdminConfigSchema,
  type CollectionConfig,
  CollectionConfigSchema,
  type CollectionHooks,
  CollectionHooksSchema,
  type CollectionLabels,
  CollectionLabelsSchema,
  createAuthCollectionConfig,
  createCollectionConfig,
  createGlobalConfig,
  createUploadCollectionConfig,
  // Field Contracts
  FIELD_SCHEMA_VERSION,
  type Field,
  type FieldAccessConfig,
  FieldAccessConfigSchema,
  type FieldAdminConfig,
  FieldAdminConfigSchema,
  type FieldHooksConfig,
  FieldHooksConfigSchema,
  type FieldOption,
  FieldOptionSchema,
  FieldSchema,
  type FieldType,
  FieldTypeSchema,
  // Global Contracts
  GLOBAL_SCHEMA_VERSION,
  type GlobalAccess,
  GlobalAccessSchema,
  type GlobalAdminConfig,
  GlobalAdminConfigSchema,
  type GlobalConfig,
  GlobalConfigSchema,
  type GlobalHooks,
  GlobalHooksSchema,
  type GlobalLabels,
  GlobalLabelsSchema,
  type GlobalVersionsConfig,
  GlobalVersionsConfigSchema,
  type GroupField,
  GroupFieldSchema,
  hasNestedFields,
  isArrayField,
  isGroupField,
  isLayoutField,
  isNumberField,
  isRelationshipField,
  isTextField,
  type NumberField,
  NumberFieldSchema,
  type RelationshipField,
  RelationshipFieldSchema,
  type RowField,
  RowFieldSchema,
  type SanitizedCollectionConfig,
  SanitizedCollectionConfigSchema,
  type SanitizedGlobalConfig,
  SanitizedGlobalConfigSchema,
  type SelectField,
  SelectFieldSchema,
  type TabDefinition,
  TabDefinitionSchema,
  type TabsField,
  TabsFieldSchema,
  type TextField,
  TextFieldSchema,
  type UploadConfig,
  UploadConfigSchema,
  type VersionsConfig,
  VersionsConfigSchema,
} from './core/index.js'
