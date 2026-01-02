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
  // Version
  REPRESENTATION_SCHEMA_VERSION,
  // Embedding
  EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_DIMENSION,
  EmbeddingSchema,
  createEmbedding,
  type Embedding,
  type EmbeddingModel,
  // Human Representation
  HumanRepresentationSchema,
  type HumanRepresentation,
  // Agent Representation
  AgentRepresentationSchema,
  AgentConstraintSchema,
  AgentActionDefinitionSchema,
  AgentRelationSchema,
  type AgentRepresentation,
  type AgentConstraint,
  type AgentActionDefinition,
  type AgentRelation,
  // Dual Entity
  DualEntitySchema,
  type DualEntity,
  // Utilities
  toHumanRepresentation,
  toAgentRepresentation,
  createTimestamps,
  updateTimestamp,
  incrementVersion,
} from './representation/index.js'

// =============================================================================
// Core Entities
// =============================================================================

export {
  // User
  USER_SCHEMA_VERSION,
  UserTypeSchema,
  UserRoleSchema,
  UserStatusSchema,
  UserPreferencesSchema,
  UserSchema,
  CreateUserInputSchema,
  UpdateUserInputSchema,
  createUser,
  type UserType,
  type UserRole,
  type UserStatus,
  type UserPreferences,
  type User,
  type CreateUserInput,
  type UpdateUserInput,
  // Session
  SessionSchema,
  createSession,
  type Session,
} from './core/user.js'

export {
  // Site
  SITE_SCHEMA_VERSION,
  SiteStatusSchema,
  SiteThemeSchema,
  SiteSeoSchema,
  SiteSettingsSchema,
  SiteCollaboratorSchema,
  SiteSchema,
  CreateSiteInputSchema,
  UpdateSiteInputSchema,
  createSite,
  canUserPerformAction,
  canAgentEditSite,
  type SiteStatus,
  type SiteTheme,
  type SiteSeo,
  type SiteSettings,
  type SiteCollaborator,
  type Site,
  type CreateSiteInput,
  type UpdateSiteInput,
} from './core/site.js'

export {
  // Page
  PAGE_SCHEMA_VERSION,
  PageStatusSchema,
  PageSeoSchema,
  PageLockSchema,
  PageSchema,
  CreatePageInputSchema,
  UpdatePageInputSchema,
  createPage,
  computePagePath,
  estimateWordCount,
  isPageLocked,
  isLockedByUser,
  createPageLock,
  getPageBreadcrumbs,
  type PageStatus,
  type PageSeo,
  type PageLock,
  type Page,
  type CreatePageInput,
  type UpdatePageInput,
} from './core/page.js'

// =============================================================================
// Blocks
// =============================================================================

export {
  // Version
  BLOCK_SCHEMA_VERSION,
  // Style & Meta
  BlockStyleSchema,
  BlockMetaSchema,
  type BlockStyle,
  type BlockMeta,
  // Block Types
  BlockTypes,
  type BlockType,
  // Individual Block Schemas
  TextBlockSchema,
  HeadingBlockSchema,
  QuoteBlockSchema,
  CodeBlockSchema,
  ImageBlockSchema,
  VideoBlockSchema,
  EmbedBlockSchema,
  ButtonBlockSchema,
  DividerBlockSchema,
  SpacerBlockSchema,
  ListBlockSchema,
  TableBlockSchema,
  ColumnsBlockSchema,
  GridBlockSchema,
  AccordionBlockSchema,
  TabsBlockSchema,
  FormBlockSchema,
  HtmlBlockSchema,
  ComponentBlockSchema,
  type TextBlock,
  type HeadingBlock,
  type QuoteBlock,
  type CodeBlock,
  type ImageBlock,
  type VideoBlock,
  type EmbedBlock,
  type ButtonBlock,
  type DividerBlock,
  type SpacerBlock,
  type ListBlock,
  type TableBlock,
  type ColumnsBlock,
  type GridBlock,
  type AccordionBlock,
  type TabsBlock,
  type FormBlock,
  type HtmlBlock,
  type ComponentBlock,
  // Union Schema
  BlockSchema,
  type Block,
  // Factories
  createTextBlock,
  createHeadingBlock,
  createImageBlock,
  createCodeBlock,
  // Type Guards
  isTextBlock,
  isHeadingBlock,
  isImageBlock,
  isColumnsBlock,
  isGridBlock,
  isContainerBlock,
  // Utilities
  walkBlocks,
  findBlockById,
  countBlocks,
} from './blocks/index.js'

// =============================================================================
// Agents
// =============================================================================

export {
  // Version
  AGENT_SCHEMA_VERSION,
  // Context
  AgentContextSchema,
  createAgentContext,
  type AgentContext,
  // Memory
  MemoryTypeSchema,
  MemorySourceSchema,
  AgentMemorySchema,
  createAgentMemory,
  type MemoryType,
  type MemorySource,
  type AgentMemory,
  // Actions
  AgentActionRecordSchema,
  type AgentActionRecord,
  // Conversation
  ConversationMessageSchema,
  ConversationSchema,
  createConversation,
  createMessage,
  type ConversationMessage,
  type Conversation,
  // Intent
  IntentTypeSchema,
  IntentSchema,
  type IntentType,
  type Intent,
  // Tools
  ToolParameterSchema,
  ToolDefinitionSchema,
  type ToolParameter,
  type ToolDefinition,
  // Agent Definition
  AgentDefinitionSchema,
  type AgentDefinition,
  // Agent State
  AgentStateSchema,
  type AgentState,
} from './agents/index.js'

// =============================================================================
// CMS Contracts
// =============================================================================

export {
  // Field Contracts
  FIELD_SCHEMA_VERSION,
  FieldTypeSchema,
  FieldAdminConfigSchema,
  FieldAccessConfigSchema,
  FieldHooksConfigSchema,
  FieldOptionSchema,
  TabDefinitionSchema,
  BaseFieldSchema,
  FieldSchema,
  TextFieldSchema,
  NumberFieldSchema,
  RelationshipFieldSchema,
  ArrayFieldSchema,
  GroupFieldSchema,
  SelectFieldSchema,
  RowFieldSchema,
  TabsFieldSchema,
  isTextField,
  isNumberField,
  isRelationshipField,
  isArrayField,
  isGroupField,
  isLayoutField,
  hasNestedFields,
  type FieldType,
  type FieldAdminConfig,
  type FieldAccessConfig,
  type FieldHooksConfig,
  type FieldOption,
  type TabDefinition,
  type Field,
  type TextField,
  type NumberField,
  type RelationshipField,
  type ArrayField,
  type GroupField,
  type SelectField,
  type RowField,
  type TabsField,
  // Collection Contracts
  COLLECTION_SCHEMA_VERSION,
  CollectionLabelsSchema,
  CollectionAccessSchema,
  CollectionHooksSchema,
  CollectionAdminConfigSchema,
  UploadConfigSchema,
  AuthConfigSchema,
  VersionsConfigSchema,
  CollectionConfigSchema,
  SanitizedCollectionConfigSchema,
  createCollectionConfig,
  createAuthCollectionConfig,
  createUploadCollectionConfig,
  type CollectionLabels,
  type CollectionAccess,
  type CollectionHooks,
  type CollectionAdminConfig,
  type UploadConfig,
  type AuthConfig,
  type VersionsConfig,
  type CollectionConfig,
  type SanitizedCollectionConfig,
  // Global Contracts
  GLOBAL_SCHEMA_VERSION,
  GlobalLabelsSchema,
  GlobalAccessSchema,
  GlobalHooksSchema,
  GlobalAdminConfigSchema,
  GlobalVersionsConfigSchema,
  GlobalConfigSchema,
  SanitizedGlobalConfigSchema,
  createGlobalConfig,
  type GlobalLabels,
  type GlobalAccess,
  type GlobalHooks,
  type GlobalAdminConfig,
  type GlobalVersionsConfig,
  type GlobalConfig,
  type SanitizedGlobalConfig,
} from './cms/index.js'
