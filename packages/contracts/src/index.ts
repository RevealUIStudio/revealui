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
 * - `@revealui/contracts/admin` - admin configuration contracts
 * - `@revealui/contracts/agents` - Agent memory/context contracts
 * - `@revealui/contracts/database` - DB ↔ Contract bridges
 * - `@revealui/contracts/actions` - Action validation
 * - `@revealui/contracts/security` - Code-pattern security rules and regex AST types
 * - `@revealui/contracts/utilities` - Shared utilities
 *
 * @packageDocumentation
 */

// Re-export zod for consumers
export { z } from 'zod/v4';

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
} from './foundation/index.js';

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
} from './representation/index.js';

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
} from './entities/page.js';

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
} from './entities/site.js';

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
} from './entities/user.js';

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
} from './content/index.js';

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
  AgentMemoryContract,
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
} from './agents/index.js';

// =============================================================================
// A2A Protocol Contracts
// =============================================================================

export {
  type A2AAgentCard,
  A2AAgentCardSchema,
  type A2AArtifact,
  A2AArtifactSchema,
  type A2AAuth,
  A2AAuthSchema,
  type A2ACapabilities,
  A2ACapabilitiesSchema,
  type A2AJsonRpcRequest,
  A2AJsonRpcRequestSchema,
  type A2AJsonRpcResponse,
  A2AJsonRpcResponseSchema,
  type A2AMessage,
  A2AMessageSchema,
  type A2APart,
  A2APartSchema,
  type A2AProvider,
  A2AProviderSchema,
  type A2ASendTaskParams,
  A2ASendTaskParamsSchema,
  type A2ASkill,
  A2ASkillSchema,
  type A2ATask,
  A2ATaskSchema,
  type A2ATaskState,
  A2ATaskStateSchema,
  type A2ATaskStatus,
  A2ATaskStatusSchema,
  agentDefinitionToCard,
  toolDefinitionToSkill,
} from './a2a/index.js';

// =============================================================================
// Admin Contracts
// =============================================================================

export {
  CollectionContract,
  type CollectionContractType,
  isCollectionConfig,
  parseCollection,
  validateCollection,
} from './admin/collection.js';
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
} from './admin/config.js';
export {
  ConfigContract,
  type ConfigContractType,
  isConfigStructure,
  parseConfigStructure,
  validateConfigStructure,
} from './admin/config-contract.js';

export {
  ConfigValidationError,
  safeValidate,
  type ValidationResult,
  validateWithErrors,
} from './admin/errors.js';

// Re-export all admin contracts from the main admin index
export * from './admin/index.js';

// =============================================================================
// Database Bridges
// =============================================================================

export {
  batchContractToDbInsert,
  batchDbRowsToContract,
  type ContractToDrizzleInsert,
  createContractToDbMapper,
  createDbRowMapper,
  createTableContractRegistry,
  DatabaseContractRegistry,
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
} from './database/index.js';

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
  // admin tables
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
} from './generated/database.js';

// =============================================================================
// API Contracts
// =============================================================================

export {
  type MFABackupCodeRequest,
  MFABackupCodeRequestContract,
  MFABackupCodeRequestSchema,
  type MFADisableRequest,
  MFADisableRequestContract,
  MFADisableRequestSchema,
  type MFASetupResponse,
  MFASetupResponseSchema,
  type MFAVerifyRequest,
  MFAVerifyRequestContract,
  MFAVerifyRequestSchema,
  type PasskeyAuthenticateOptionsRequest,
  PasskeyAuthenticateOptionsRequestSchema,
  type PasskeyAuthenticateVerifyRequest,
  PasskeyAuthenticateVerifyRequestSchema,
  type PasskeyListResponse,
  PasskeyListResponseSchema,
  type PasskeyRegisterOptionsRequest,
  PasskeyRegisterOptionsRequestSchema,
  type PasskeyRegisterVerifyRequest,
  PasskeyRegisterVerifyRequestSchema,
  type PasskeyUpdateRequest,
  PasskeyUpdateRequestSchema,
  type PasswordResetRequest,
  PasswordResetRequestContract,
  PasswordResetRequestSchema,
  type PasswordResetToken,
  PasswordResetTokenContract,
  PasswordResetTokenSchema,
  type RecoveryRequest,
  RecoveryRequestSchema,
  type RecoveryVerifyRequest,
  RecoveryVerifyRequestSchema,
  type SignInRequest,
  SignInRequestContract,
  SignInRequestSchema,
  type SignUpRequest,
  SignUpRequestContract,
  SignUpRequestSchema,
} from './api/auth.js';
export {
  type ChatMessage,
  ChatMessageSchema,
  type ChatRequest,
  ChatRequestContract,
  ChatRequestSchema,
} from './api/chat.js';
export {
  type GDPRDeleteRequest,
  GDPRDeleteRequestContract,
  GDPRDeleteRequestSchema,
  type GDPRExportRequest,
  GDPRExportRequestContract,
  GDPRExportRequestSchema,
} from './api/gdpr.js';

// =============================================================================
// LLM Providers
// =============================================================================

export { LLM_PROVIDERS, type LLMProvider } from './providers.js';

// =============================================================================
// Pricing
// =============================================================================

export {
  CREDIT_BUNDLES,
  type CreditBundle,
  FEATURE_LABELS,
  type FeatureFlagKey,
  getTierColor,
  getTierLabel,
  getTiersFromCurrent,
  type LicenseTierId,
  PERPETUAL_TIERS,
  type PerpetualTier,
  type PricingResponse,
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
  TIER_COLORS,
  TIER_LABELS,
  TIER_LIMITS,
  type TierLimits,
} from './pricing.js';

// =============================================================================
// Stripe Webhook Events (canonical list — single source of truth)
// =============================================================================

export {
  RELEVANT_STRIPE_WEBHOOK_EVENT_COUNT,
  RELEVANT_STRIPE_WEBHOOK_EVENTS,
  type RelevantStripeWebhookEvent,
} from './stripe-webhook-events.js';

// =============================================================================
// RevealCoin (RVUI)
// =============================================================================

export {
  formatRvuiAmount,
  getRvuiMintAddress,
  parseRvuiAmount,
  RVUI_ALLOCATIONS,
  RVUI_DISCOUNT_RATES,
  RVUI_MINT_ADDRESSES,
  RVUI_MINT_AUTHORITY,
  RVUI_TOKEN_CONFIG,
  RVUI_TOKEN_PROGRAM,
  type RvuiAllocation,
  type RvuiDiscountRate,
  type RvuiTokenConfig,
  type SolanaNetwork,
} from './revealcoin.js';

// =============================================================================
// Content Validation
// =============================================================================

export {
  type ContentValidationConfig,
  type ContentValidationResult,
  configureContentValidation,
  resetContentValidationConfig,
  validateBlocks,
  validateContent,
} from './content-validation.js';

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
} from './actions/index.js';

// =============================================================================
// Security
// =============================================================================

export {
  // Built-in rules
  EXEC_SYNC_STRING_RULE,
  // Rule system
  type IssueLocation,
  IssueLocationSchema,
  REDOS_REGEX_RULE,
  // Ret AST types
  type RetChar,
  RetCharSchema,
  type RetGroup,
  RetGroupSchema,
  type RetNode,
  RetNodeType,
  type RetNodeTypeValue,
  type RetPosition,
  RetPositionSchema,
  type RetRange,
  RetRangeSchema,
  type RetReference,
  RetReferenceSchema,
  type RetRepetition,
  RetRepetitionSchema,
  type RetRoot,
  RetRootSchema,
  type RetSet,
  type RetSetMember,
  RetSetSchema,
  type RetToken,
  RetTokenSchema,
  SECURITY_RULES,
  type SecurityCategory,
  SecurityCategorySchema,
  type SecurityFinding,
  SecurityFindingContract,
  SecurityFindingSchema,
  type SecurityRule,
  SecurityRuleContract,
  type SecurityRuleId,
  SecurityRuleSchema,
  type SecuritySeverity,
  SecuritySeveritySchema,
  TOCTOU_STAT_READ_RULE,
} from './security/index.js';
