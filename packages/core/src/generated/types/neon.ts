/* tslint:disable */
/**
 * Generated Database Types for NeonDB
 *
 * This file re-exports database types from @revealui/contracts/generated
 * to maintain backward compatibility while breaking circular dependencies.
 *
 * Last updated: 2026-01-25T00:00:00.000Z
 */

// Re-export all database types from contracts
export {
  type Database,
  type DatabaseRow,
  type DatabaseInsert,
  type DatabaseUpdate,
  // Agent tables
  type AgentActionsRow,
  type AgentActionsInsert,
  type AgentActionsUpdate,
  type AgentContextsRow,
  type AgentContextsInsert,
  type AgentContextsUpdate,
  type AgentMemoriesRow,
  type AgentMemoriesInsert,
  type AgentMemoriesUpdate,
  type ConversationsRow,
  type ConversationsInsert,
  type ConversationsUpdate,
  // CRDT tables
  type CrdtOperationsRow,
  type CrdtOperationsInsert,
  type CrdtOperationsUpdate,
  type NodeIdMappingsRow,
  type NodeIdMappingsInsert,
  type NodeIdMappingsUpdate,
  // admin tables
  type GlobalFooterRow,
  type GlobalFooterInsert,
  type GlobalFooterUpdate,
  type GlobalHeaderRow,
  type GlobalHeaderInsert,
  type GlobalHeaderUpdate,
  type GlobalSettingsRow,
  type GlobalSettingsInsert,
  type GlobalSettingsUpdate,
  type MediaRow,
  type MediaInsert,
  type MediaUpdate,
  type PagesRow,
  type PagesInsert,
  type PagesUpdate,
  type PageRevisionsRow,
  type PageRevisionsInsert,
  type PageRevisionsUpdate,
  type PostsRow,
  type PostsInsert,
  type PostsUpdate,
  // Security tables
  type FailedAttemptsRow,
  type FailedAttemptsInsert,
  type FailedAttemptsUpdate,
  type RateLimitsRow,
  type RateLimitsInsert,
  type RateLimitsUpdate,
  type SessionsRow,
  type SessionsInsert,
  type SessionsUpdate,
  type UsersRow,
  type UsersInsert,
  type UsersUpdate,
  // Site management
  type SitesRow,
  type SitesInsert,
  type SitesUpdate,
  type SiteCollaboratorsRow,
  type SiteCollaboratorsInsert,
  type SiteCollaboratorsUpdate,
} from '@revealui/contracts/generated'

// TableName is exported from main contracts package, not generated
export { type TableName } from '@revealui/contracts'