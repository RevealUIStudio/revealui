/**
 * Database Type Exports
 *
 * This file re-exports database types from the auto-generated sources.
 * All types are now auto-generated from Drizzle schemas - see @revealui/contracts/generated/zod-schemas
 * and contracts.ts for the generated types.
 *
 * Previously: 768 lines of manually maintained types
 * Now: Re-exports from auto-generated files
 *
 * To regenerate: pnpm generate:all
 */

// Re-export all Zod schemas and types from db package
export * from './zod-schemas.js'

// Re-export all Contract wrappers
export * from './contracts.js'

// For backward compatibility, re-export common types with legacy names
export type {
  AgentActionsRow,
  AgentActionsInsert,
  AgentContextsRow,
  AgentContextsInsert,
  AgentMemoriesRow,
  AgentMemoriesInsert,
  ConversationsRow,
  ConversationsInsert,
  CrdtOperationsRow,
  CrdtOperationsInsert,
  FailedAttemptsRow,
  FailedAttemptsInsert,
  GlobalFooterRow,
  GlobalFooterInsert,
  GlobalHeaderRow,
  GlobalHeaderInsert,
  GlobalSettingsRow,
  GlobalSettingsInsert,
  McpDocumentOperationsRow,
  McpDocumentOperationsInsert,
  MediaRow,
  MediaInsert,
  MessagesRow,
  MessagesInsert,
  NodeIdMappingsRow,
  NodeIdMappingsInsert,
  PageRevisionsRow,
  PageRevisionsInsert,
  PagesRow,
  PagesInsert,
  PasswordResetTokensRow,
  PasswordResetTokensInsert,
  PostsRow,
  PostsInsert,
  RateLimitsRow,
  RateLimitsInsert,
  SessionsRow,
  SessionsInsert,
  SiteCollaboratorsRow,
  SiteCollaboratorsInsert,
  SitesRow,
  SitesInsert,
  SyncMetadataRow,
  SyncMetadataInsert,
  UserDevicesRow,
  UserDevicesInsert,
  UsersRow,
  UsersInsert,
} from './zod-schemas.js'

// Legacy Update types (for backward compatibility)
export type AgentActionsUpdate = Partial<import('./zod-schemas.js').AgentActionsInsert>
export type AgentContextsUpdate = Partial<import('./zod-schemas.js').AgentContextsInsert>
export type AgentMemoriesUpdate = Partial<import('./zod-schemas.js').AgentMemoriesInsert>
export type ConversationsUpdate = Partial<import('./zod-schemas.js').ConversationsInsert>
export type CrdtOperationsUpdate = Partial<import('./zod-schemas.js').CrdtOperationsInsert>
export type FailedAttemptsUpdate = Partial<import('./zod-schemas.js').FailedAttemptsInsert>
export type GlobalFooterUpdate = Partial<import('./zod-schemas.js').GlobalFooterInsert>
export type GlobalHeaderUpdate = Partial<import('./zod-schemas.js').GlobalHeaderInsert>
export type GlobalSettingsUpdate = Partial<import('./zod-schemas.js').GlobalSettingsInsert>
export type McpDocumentOperationsUpdate = Partial<
  import('./zod-schemas.js').McpDocumentOperationsInsert
>
export type MediaUpdate = Partial<import('./zod-schemas.js').MediaInsert>
export type MessagesUpdate = Partial<import('./zod-schemas.js').MessagesInsert>
export type NodeIdMappingsUpdate = Partial<import('./zod-schemas.js').NodeIdMappingsInsert>
export type PageRevisionsUpdate = Partial<import('./zod-schemas.js').PageRevisionsInsert>
export type PagesUpdate = Partial<import('./zod-schemas.js').PagesInsert>
export type PasswordResetTokensUpdate = Partial<
  import('./zod-schemas.js').PasswordResetTokensInsert
>
export type PostsUpdate = Partial<import('./zod-schemas.js').PostsInsert>
export type RateLimitsUpdate = Partial<import('./zod-schemas.js').RateLimitsInsert>
export type SessionsUpdate = Partial<import('./zod-schemas.js').SessionsInsert>
export type SiteCollaboratorsUpdate = Partial<import('./zod-schemas.js').SiteCollaboratorsInsert>
export type SitesUpdate = Partial<import('./zod-schemas.js').SitesInsert>
export type SyncMetadataUpdate = Partial<import('./zod-schemas.js').SyncMetadataInsert>
export type UserDevicesUpdate = Partial<import('./zod-schemas.js').UserDevicesInsert>
export type UsersUpdate = Partial<import('./zod-schemas.js').UsersInsert>

// Legacy Database type structure (for backward compatibility with old code)
export interface Database {
  public: {
    Tables: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}

export type DatabaseRow =
  | import('./zod-schemas.js').UsersRow
  | import('./zod-schemas.js').SitesRow
  | import('./zod-schemas.js').PagesRow
export type DatabaseInsert =
  | import('./zod-schemas.js').UsersInsert
  | import('./zod-schemas.js').SitesInsert
  | import('./zod-schemas.js').PagesInsert
export type DatabaseUpdate = UsersUpdate | SitesUpdate | PagesUpdate
