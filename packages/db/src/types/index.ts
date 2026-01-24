/**
 * @revealui/db/types - Database Type Exports
 *
 * Centralized type exports for NeonDB database.
 * Provides feature parity with Supabase's Database type structure.
 *
 * ## Usage
 *
 * ```typescript
 * import type { Database } from '@revealui/db/types'
 *
 * // Extract table types
 * type User = Database['public']['Tables']['users']['Row']
 * type NewUser = Database['public']['Tables']['users']['Insert']
 * type UserUpdate = Database['public']['Tables']['users']['Update']
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
} from './database.js'
