/**
 * @revealui/db/types - Database Type Exports
 *
 * Centralized type exports for Neon (Drizzle).
 * `Database['public']['Tables']` is a leftover Supabase-shaped index, not a
 * second database. Prefer table-specific Row/Insert types.
 *
 * ## Usage
 *
 * ```typescript
 * import type { UsersRow, UsersInsert } from '@revealui/db/types'
 * ```
 */

// Re-export the generated Database type
export type {
  AgentActionsInsert,
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
  CrdtOperationsRow,
  CrdtOperationsUpdate,
  Database,
  DatabaseEnums,
  DatabaseRelationships,
  FailedAttemptsInsert,
  FailedAttemptsRow,
  FailedAttemptsUpdate,
  GlobalFooterInsert,
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
  SitesRow,
  SitesUpdate,
  TableInsert,
  TableRelationships,
  TableRow,
  TableUpdate,
  UsersInsert,
  // Individual table types
  UsersRow,
  UsersUpdate,
} from './database.js';
