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
export * from '@revealui/contracts/generated/zod-schemas'

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
} from '@revealui/contracts/generated/zod-schemas'

// Legacy Update types (for backward compatibility)
export type AgentActionsUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').AgentActionsInsert>
export type AgentContextsUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').AgentContextsInsert>
export type AgentMemoriesUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').AgentMemoriesInsert>
export type ConversationsUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').ConversationsInsert>
export type CrdtOperationsUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').CrdtOperationsInsert>
export type FailedAttemptsUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').FailedAttemptsInsert>
export type GlobalFooterUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').GlobalFooterInsert>
export type GlobalHeaderUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').GlobalHeaderInsert>
export type GlobalSettingsUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').GlobalSettingsInsert>
export type MediaUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').MediaInsert>
export type MessagesUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').MessagesInsert>
export type NodeIdMappingsUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').NodeIdMappingsInsert>
export type PageRevisionsUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').PageRevisionsInsert>
export type PagesUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').PagesInsert>
export type PasswordResetTokensUpdate = Partial<
  import('@revealui/contracts/generated/zod-schemas').PasswordResetTokensInsert
>
export type PostsUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').PostsInsert>
export type RateLimitsUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').RateLimitsInsert>
export type SessionsUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').SessionsInsert>
export type SiteCollaboratorsUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').SiteCollaboratorsInsert>
export type SitesUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').SitesInsert>
export type SyncMetadataUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').SyncMetadataInsert>
export type UserDevicesUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').UserDevicesInsert>
export type UsersUpdate = Partial<import('@revealui/contracts/generated/zod-schemas').UsersInsert>

// Legacy Database type structure (for backward compatibility with old code)
export interface Database {
  public: {
    Tables: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}

export type DatabaseRow =
  | import('@revealui/contracts/generated/zod-schemas').UsersRow
  | import('@revealui/contracts/generated/zod-schemas').SitesRow
  | import('@revealui/contracts/generated/zod-schemas').PagesRow
export type DatabaseInsert =
  | import('@revealui/contracts/generated/zod-schemas').UsersInsert
  | import('@revealui/contracts/generated/zod-schemas').SitesInsert
  | import('@revealui/contracts/generated/zod-schemas').PagesInsert
export type DatabaseUpdate = UsersUpdate | SitesUpdate | PagesUpdate
