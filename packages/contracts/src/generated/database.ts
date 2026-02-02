/**
 * Database Type Exports
 *
 * This file re-exports database types from the auto-generated sources.
 * All types are now auto-generated from Drizzle schemas - see @revealui/db/generated/zod-schemas
 * and contracts.ts for the generated types.
 *
 * Previously: 768 lines of manually maintained types
 * Now: Re-exports from auto-generated files
 *
 * To regenerate: pnpm generate:all
 */

// Re-export all Zod schemas and types from db package
export * from '@revealui/db/generated/zod-schemas'

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
} from '@revealui/db/generated/zod-schemas'

// Legacy Update types (for backward compatibility)
export type AgentActionsUpdate = Partial<import('@revealui/db/generated/zod-schemas').AgentActionsInsert>
export type AgentContextsUpdate = Partial<import('@revealui/db/generated/zod-schemas').AgentContextsInsert>
export type AgentMemoriesUpdate = Partial<import('@revealui/db/generated/zod-schemas').AgentMemoriesInsert>
export type ConversationsUpdate = Partial<import('@revealui/db/generated/zod-schemas').ConversationsInsert>
export type CrdtOperationsUpdate = Partial<import('@revealui/db/generated/zod-schemas').CrdtOperationsInsert>
export type FailedAttemptsUpdate = Partial<import('@revealui/db/generated/zod-schemas').FailedAttemptsInsert>
export type GlobalFooterUpdate = Partial<import('@revealui/db/generated/zod-schemas').GlobalFooterInsert>
export type GlobalHeaderUpdate = Partial<import('@revealui/db/generated/zod-schemas').GlobalHeaderInsert>
export type GlobalSettingsUpdate = Partial<import('@revealui/db/generated/zod-schemas').GlobalSettingsInsert>
export type MediaUpdate = Partial<import('@revealui/db/generated/zod-schemas').MediaInsert>
export type MessagesUpdate = Partial<import('@revealui/db/generated/zod-schemas').MessagesInsert>
export type NodeIdMappingsUpdate = Partial<import('@revealui/db/generated/zod-schemas').NodeIdMappingsInsert>
export type PageRevisionsUpdate = Partial<import('@revealui/db/generated/zod-schemas').PageRevisionsInsert>
export type PagesUpdate = Partial<import('@revealui/db/generated/zod-schemas').PagesInsert>
export type PasswordResetTokensUpdate = Partial<
  import('@revealui/db/generated/zod-schemas').PasswordResetTokensInsert
>
export type PostsUpdate = Partial<import('@revealui/db/generated/zod-schemas').PostsInsert>
export type RateLimitsUpdate = Partial<import('@revealui/db/generated/zod-schemas').RateLimitsInsert>
export type SessionsUpdate = Partial<import('@revealui/db/generated/zod-schemas').SessionsInsert>
export type SiteCollaboratorsUpdate = Partial<import('@revealui/db/generated/zod-schemas').SiteCollaboratorsInsert>
export type SitesUpdate = Partial<import('@revealui/db/generated/zod-schemas').SitesInsert>
export type SyncMetadataUpdate = Partial<import('@revealui/db/generated/zod-schemas').SyncMetadataInsert>
export type UserDevicesUpdate = Partial<import('@revealui/db/generated/zod-schemas').UserDevicesInsert>
export type UsersUpdate = Partial<import('@revealui/db/generated/zod-schemas').UsersInsert>

// Legacy Database type structure (for backward compatibility with old code)
export interface Database {
  public: {
    Tables: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}

export type DatabaseRow =
  | import('@revealui/db/generated/zod-schemas').UsersRow
  | import('@revealui/db/generated/zod-schemas').SitesRow
  | import('@revealui/db/generated/zod-schemas').PagesRow
export type DatabaseInsert =
  | import('@revealui/db/generated/zod-schemas').UsersInsert
  | import('@revealui/db/generated/zod-schemas').SitesInsert
  | import('@revealui/db/generated/zod-schemas').PagesInsert
export type DatabaseUpdate = UsersUpdate | SitesUpdate | PagesUpdate
