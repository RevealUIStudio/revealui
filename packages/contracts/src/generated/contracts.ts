/**
 * Auto-generated Contract wrappers
 *
 * DO NOT EDIT - Regenerate with: pnpm generate:all
 * Generated: 2026-02-19T07:11:45.135Z
 *
 * This file provides Contract wrappers for all database tables.
 * Contracts combine TypeScript types, Zod schemas, and runtime validation
 * into a single unified interface.
 *
 * These base contracts can be extended in entity contracts to add
 * business logic, computed fields, and custom validation rules.
 */

import { createContract } from '../foundation/contract.js'
import * as Schemas from '@revealui/contracts/generated/zod-schemas'

// =============================================================================
// AgentActions Contracts
// =============================================================================

/**
 * Contract for agentActions row (Select)
 * Database table: agent_actions
 */
export const AgentActionsRowContract = createContract({
  name: 'AgentActionsRow',
  version: '1',
  description: 'Database row contract for agent_actions table',
  schema: Schemas.AgentActionsSelectSchema,
})

/**
 * Contract for agentActions insert
 * Database table: agent_actions
 */
export const AgentActionsInsertContract = createContract({
  name: 'AgentActionsInsert',
  version: '1',
  description: 'Database insert contract for agent_actions table',
  schema: Schemas.AgentActionsInsertSchema,
})

// =============================================================================
// AgentContexts Contracts
// =============================================================================

/**
 * Contract for agentContexts row (Select)
 * Database table: agent_contexts
 */
export const AgentContextsRowContract = createContract({
  name: 'AgentContextsRow',
  version: '1',
  description: 'Database row contract for agent_contexts table',
  schema: Schemas.AgentContextsSelectSchema,
})

/**
 * Contract for agentContexts insert
 * Database table: agent_contexts
 */
export const AgentContextsInsertContract = createContract({
  name: 'AgentContextsInsert',
  version: '1',
  description: 'Database insert contract for agent_contexts table',
  schema: Schemas.AgentContextsInsertSchema,
})

// =============================================================================
// AgentMemories Contracts
// =============================================================================

/**
 * Contract for agentMemories row (Select)
 * Database table: agent_memories
 */
export const AgentMemoriesRowContract = createContract({
  name: 'AgentMemoriesRow',
  version: '1',
  description: 'Database row contract for agent_memories table',
  schema: Schemas.AgentMemoriesSelectSchema,
})

/**
 * Contract for agentMemories insert
 * Database table: agent_memories
 */
export const AgentMemoriesInsertContract = createContract({
  name: 'AgentMemoriesInsert',
  version: '1',
  description: 'Database insert contract for agent_memories table',
  schema: Schemas.AgentMemoriesInsertSchema,
})

// =============================================================================
// AuditLog Contracts
// =============================================================================

/**
 * Contract for auditLog row (Select)
 * Database table: audit_log
 */
export const AuditLogRowContract = createContract({
  name: 'AuditLogRow',
  version: '1',
  description: 'Database row contract for audit_log table',
  schema: Schemas.AuditLogSelectSchema,
})

/**
 * Contract for auditLog insert
 * Database table: audit_log
 */
export const AuditLogInsertContract = createContract({
  name: 'AuditLogInsert',
  version: '1',
  description: 'Database insert contract for audit_log table',
  schema: Schemas.AuditLogInsertSchema,
})

// =============================================================================
// BoardColumns Contracts
// =============================================================================

/**
 * Contract for boardColumns row (Select)
 * Database table: board_columns
 */
export const BoardColumnsRowContract = createContract({
  name: 'BoardColumnsRow',
  version: '1',
  description: 'Database row contract for board_columns table',
  schema: Schemas.BoardColumnsSelectSchema,
})

/**
 * Contract for boardColumns insert
 * Database table: board_columns
 */
export const BoardColumnsInsertContract = createContract({
  name: 'BoardColumnsInsert',
  version: '1',
  description: 'Database insert contract for board_columns table',
  schema: Schemas.BoardColumnsInsertSchema,
})

// =============================================================================
// Boards Contracts
// =============================================================================

/**
 * Contract for boards row (Select)
 * Database table: boards
 */
export const BoardsRowContract = createContract({
  name: 'BoardsRow',
  version: '1',
  description: 'Database row contract for boards table',
  schema: Schemas.BoardsSelectSchema,
})

/**
 * Contract for boards insert
 * Database table: boards
 */
export const BoardsInsertContract = createContract({
  name: 'BoardsInsert',
  version: '1',
  description: 'Database insert contract for boards table',
  schema: Schemas.BoardsInsertSchema,
})

// =============================================================================
// CodeProvenance Contracts
// =============================================================================

/**
 * Contract for codeProvenance row (Select)
 * Database table: code_provenance
 */
export const CodeProvenanceRowContract = createContract({
  name: 'CodeProvenanceRow',
  version: '1',
  description: 'Database row contract for code_provenance table',
  schema: Schemas.CodeProvenanceSelectSchema,
})

/**
 * Contract for codeProvenance insert
 * Database table: code_provenance
 */
export const CodeProvenanceInsertContract = createContract({
  name: 'CodeProvenanceInsert',
  version: '1',
  description: 'Database insert contract for code_provenance table',
  schema: Schemas.CodeProvenanceInsertSchema,
})

// =============================================================================
// CodeReviews Contracts
// =============================================================================

/**
 * Contract for codeReviews row (Select)
 * Database table: code_reviews
 */
export const CodeReviewsRowContract = createContract({
  name: 'CodeReviewsRow',
  version: '1',
  description: 'Database row contract for code_reviews table',
  schema: Schemas.CodeReviewsSelectSchema,
})

/**
 * Contract for codeReviews insert
 * Database table: code_reviews
 */
export const CodeReviewsInsertContract = createContract({
  name: 'CodeReviewsInsert',
  version: '1',
  description: 'Database insert contract for code_reviews table',
  schema: Schemas.CodeReviewsInsertSchema,
})

// =============================================================================
// CollabEdits Contracts
// =============================================================================

/**
 * Contract for collabEdits row (Select)
 * Database table: collab_edits
 */
export const CollabEditsRowContract = createContract({
  name: 'CollabEditsRow',
  version: '1',
  description: 'Database row contract for collab_edits table',
  schema: Schemas.CollabEditsSelectSchema,
})

/**
 * Contract for collabEdits insert
 * Database table: collab_edits
 */
export const CollabEditsInsertContract = createContract({
  name: 'CollabEditsInsert',
  version: '1',
  description: 'Database insert contract for collab_edits table',
  schema: Schemas.CollabEditsInsertSchema,
})

// =============================================================================
// Conversations Contracts
// =============================================================================

/**
 * Contract for conversations row (Select)
 * Database table: conversations
 */
export const ConversationsRowContract = createContract({
  name: 'ConversationsRow',
  version: '1',
  description: 'Database row contract for conversations table',
  schema: Schemas.ConversationsSelectSchema,
})

/**
 * Contract for conversations insert
 * Database table: conversations
 */
export const ConversationsInsertContract = createContract({
  name: 'ConversationsInsert',
  version: '1',
  description: 'Database insert contract for conversations table',
  schema: Schemas.ConversationsInsertSchema,
})

// =============================================================================
// CrdtOperations Contracts
// =============================================================================

/**
 * Contract for crdtOperations row (Select)
 * Database table: crdt_operations
 */
export const CrdtOperationsRowContract = createContract({
  name: 'CrdtOperationsRow',
  version: '1',
  description: 'Database row contract for crdt_operations table',
  schema: Schemas.CrdtOperationsSelectSchema,
})

/**
 * Contract for crdtOperations insert
 * Database table: crdt_operations
 */
export const CrdtOperationsInsertContract = createContract({
  name: 'CrdtOperationsInsert',
  version: '1',
  description: 'Database insert contract for crdt_operations table',
  schema: Schemas.CrdtOperationsInsertSchema,
})

// =============================================================================
// FailedAttempts Contracts
// =============================================================================

/**
 * Contract for failedAttempts row (Select)
 * Database table: failed_attempts
 */
export const FailedAttemptsRowContract = createContract({
  name: 'FailedAttemptsRow',
  version: '1',
  description: 'Database row contract for failed_attempts table',
  schema: Schemas.FailedAttemptsSelectSchema,
})

/**
 * Contract for failedAttempts insert
 * Database table: failed_attempts
 */
export const FailedAttemptsInsertContract = createContract({
  name: 'FailedAttemptsInsert',
  version: '1',
  description: 'Database insert contract for failed_attempts table',
  schema: Schemas.FailedAttemptsInsertSchema,
})

// =============================================================================
// GlobalFooter Contracts
// =============================================================================

/**
 * Contract for globalFooter row (Select)
 * Database table: global_footer
 */
export const GlobalFooterRowContract = createContract({
  name: 'GlobalFooterRow',
  version: '1',
  description: 'Database row contract for global_footer table',
  schema: Schemas.GlobalFooterSelectSchema,
})

/**
 * Contract for globalFooter insert
 * Database table: global_footer
 */
export const GlobalFooterInsertContract = createContract({
  name: 'GlobalFooterInsert',
  version: '1',
  description: 'Database insert contract for global_footer table',
  schema: Schemas.GlobalFooterInsertSchema,
})

// =============================================================================
// GlobalHeader Contracts
// =============================================================================

/**
 * Contract for globalHeader row (Select)
 * Database table: global_header
 */
export const GlobalHeaderRowContract = createContract({
  name: 'GlobalHeaderRow',
  version: '1',
  description: 'Database row contract for global_header table',
  schema: Schemas.GlobalHeaderSelectSchema,
})

/**
 * Contract for globalHeader insert
 * Database table: global_header
 */
export const GlobalHeaderInsertContract = createContract({
  name: 'GlobalHeaderInsert',
  version: '1',
  description: 'Database insert contract for global_header table',
  schema: Schemas.GlobalHeaderInsertSchema,
})

// =============================================================================
// GlobalSettings Contracts
// =============================================================================

/**
 * Contract for globalSettings row (Select)
 * Database table: global_settings
 */
export const GlobalSettingsRowContract = createContract({
  name: 'GlobalSettingsRow',
  version: '1',
  description: 'Database row contract for global_settings table',
  schema: Schemas.GlobalSettingsSelectSchema,
})

/**
 * Contract for globalSettings insert
 * Database table: global_settings
 */
export const GlobalSettingsInsertContract = createContract({
  name: 'GlobalSettingsInsert',
  version: '1',
  description: 'Database insert contract for global_settings table',
  schema: Schemas.GlobalSettingsInsertSchema,
})

// =============================================================================
// Licenses Contracts
// =============================================================================

/**
 * Contract for licenses row (Select)
 * Database table: licenses
 */
export const LicensesRowContract = createContract({
  name: 'LicensesRow',
  version: '1',
  description: 'Database row contract for licenses table',
  schema: Schemas.LicensesSelectSchema,
})

/**
 * Contract for licenses insert
 * Database table: licenses
 */
export const LicensesInsertContract = createContract({
  name: 'LicensesInsert',
  version: '1',
  description: 'Database insert contract for licenses table',
  schema: Schemas.LicensesInsertSchema,
})

// =============================================================================
// Media Contracts
// =============================================================================

/**
 * Contract for media row (Select)
 * Database table: media
 */
export const MediaRowContract = createContract({
  name: 'MediaRow',
  version: '1',
  description: 'Database row contract for media table',
  schema: Schemas.MediaSelectSchema,
})

/**
 * Contract for media insert
 * Database table: media
 */
export const MediaInsertContract = createContract({
  name: 'MediaInsert',
  version: '1',
  description: 'Database insert contract for media table',
  schema: Schemas.MediaInsertSchema,
})

// =============================================================================
// Messages Contracts
// =============================================================================

/**
 * Contract for messages row (Select)
 * Database table: messages
 */
export const MessagesRowContract = createContract({
  name: 'MessagesRow',
  version: '1',
  description: 'Database row contract for messages table',
  schema: Schemas.MessagesSelectSchema,
})

/**
 * Contract for messages insert
 * Database table: messages
 */
export const MessagesInsertContract = createContract({
  name: 'MessagesInsert',
  version: '1',
  description: 'Database insert contract for messages table',
  schema: Schemas.MessagesInsertSchema,
})

// =============================================================================
// NodeIdMappings Contracts
// =============================================================================

/**
 * Contract for nodeIdMappings row (Select)
 * Database table: node_id_mappings
 */
export const NodeIdMappingsRowContract = createContract({
  name: 'NodeIdMappingsRow',
  version: '1',
  description: 'Database row contract for node_id_mappings table',
  schema: Schemas.NodeIdMappingsSelectSchema,
})

/**
 * Contract for nodeIdMappings insert
 * Database table: node_id_mappings
 */
export const NodeIdMappingsInsertContract = createContract({
  name: 'NodeIdMappingsInsert',
  version: '1',
  description: 'Database insert contract for node_id_mappings table',
  schema: Schemas.NodeIdMappingsInsertSchema,
})

// =============================================================================
// PageRevisions Contracts
// =============================================================================

/**
 * Contract for pageRevisions row (Select)
 * Database table: page_revisions
 */
export const PageRevisionsRowContract = createContract({
  name: 'PageRevisionsRow',
  version: '1',
  description: 'Database row contract for page_revisions table',
  schema: Schemas.PageRevisionsSelectSchema,
})

/**
 * Contract for pageRevisions insert
 * Database table: page_revisions
 */
export const PageRevisionsInsertContract = createContract({
  name: 'PageRevisionsInsert',
  version: '1',
  description: 'Database insert contract for page_revisions table',
  schema: Schemas.PageRevisionsInsertSchema,
})

// =============================================================================
// Pages Contracts
// =============================================================================

/**
 * Contract for pages row (Select)
 * Database table: pages
 */
export const PagesRowContract = createContract({
  name: 'PagesRow',
  version: '1',
  description: 'Database row contract for pages table',
  schema: Schemas.PagesSelectSchema,
})

/**
 * Contract for pages insert
 * Database table: pages
 */
export const PagesInsertContract = createContract({
  name: 'PagesInsert',
  version: '1',
  description: 'Database insert contract for pages table',
  schema: Schemas.PagesInsertSchema,
})

// =============================================================================
// PasswordResetTokens Contracts
// =============================================================================

/**
 * Contract for passwordResetTokens row (Select)
 * Database table: password_reset_tokens
 */
export const PasswordResetTokensRowContract = createContract({
  name: 'PasswordResetTokensRow',
  version: '1',
  description: 'Database row contract for password_reset_tokens table',
  schema: Schemas.PasswordResetTokensSelectSchema,
})

/**
 * Contract for passwordResetTokens insert
 * Database table: password_reset_tokens
 */
export const PasswordResetTokensInsertContract = createContract({
  name: 'PasswordResetTokensInsert',
  version: '1',
  description: 'Database insert contract for password_reset_tokens table',
  schema: Schemas.PasswordResetTokensInsertSchema,
})

// =============================================================================
// Posts Contracts
// =============================================================================

/**
 * Contract for posts row (Select)
 * Database table: posts
 */
export const PostsRowContract = createContract({
  name: 'PostsRow',
  version: '1',
  description: 'Database row contract for posts table',
  schema: Schemas.PostsSelectSchema,
})

/**
 * Contract for posts insert
 * Database table: posts
 */
export const PostsInsertContract = createContract({
  name: 'PostsInsert',
  version: '1',
  description: 'Database insert contract for posts table',
  schema: Schemas.PostsInsertSchema,
})

// =============================================================================
// RateLimits Contracts
// =============================================================================

/**
 * Contract for rateLimits row (Select)
 * Database table: rate_limits
 */
export const RateLimitsRowContract = createContract({
  name: 'RateLimitsRow',
  version: '1',
  description: 'Database row contract for rate_limits table',
  schema: Schemas.RateLimitsSelectSchema,
})

/**
 * Contract for rateLimits insert
 * Database table: rate_limits
 */
export const RateLimitsInsertContract = createContract({
  name: 'RateLimitsInsert',
  version: '1',
  description: 'Database insert contract for rate_limits table',
  schema: Schemas.RateLimitsInsertSchema,
})

// =============================================================================
// Sessions Contracts
// =============================================================================

/**
 * Contract for sessions row (Select)
 * Database table: sessions
 */
export const SessionsRowContract = createContract({
  name: 'SessionsRow',
  version: '1',
  description: 'Database row contract for sessions table',
  schema: Schemas.SessionsSelectSchema,
})

/**
 * Contract for sessions insert
 * Database table: sessions
 */
export const SessionsInsertContract = createContract({
  name: 'SessionsInsert',
  version: '1',
  description: 'Database insert contract for sessions table',
  schema: Schemas.SessionsInsertSchema,
})

// =============================================================================
// SiteCollaborators Contracts
// =============================================================================

/**
 * Contract for siteCollaborators row (Select)
 * Database table: site_collaborators
 */
export const SiteCollaboratorsRowContract = createContract({
  name: 'SiteCollaboratorsRow',
  version: '1',
  description: 'Database row contract for site_collaborators table',
  schema: Schemas.SiteCollaboratorsSelectSchema,
})

/**
 * Contract for siteCollaborators insert
 * Database table: site_collaborators
 */
export const SiteCollaboratorsInsertContract = createContract({
  name: 'SiteCollaboratorsInsert',
  version: '1',
  description: 'Database insert contract for site_collaborators table',
  schema: Schemas.SiteCollaboratorsInsertSchema,
})

// =============================================================================
// Sites Contracts
// =============================================================================

/**
 * Contract for sites row (Select)
 * Database table: sites
 */
export const SitesRowContract = createContract({
  name: 'SitesRow',
  version: '1',
  description: 'Database row contract for sites table',
  schema: Schemas.SitesSelectSchema,
})

/**
 * Contract for sites insert
 * Database table: sites
 */
export const SitesInsertContract = createContract({
  name: 'SitesInsert',
  version: '1',
  description: 'Database insert contract for sites table',
  schema: Schemas.SitesInsertSchema,
})

// =============================================================================
// SyncMetadata Contracts
// =============================================================================

/**
 * Contract for syncMetadata row (Select)
 * Database table: sync_metadata
 */
export const SyncMetadataRowContract = createContract({
  name: 'SyncMetadataRow',
  version: '1',
  description: 'Database row contract for sync_metadata table',
  schema: Schemas.SyncMetadataSelectSchema,
})

/**
 * Contract for syncMetadata insert
 * Database table: sync_metadata
 */
export const SyncMetadataInsertContract = createContract({
  name: 'SyncMetadataInsert',
  version: '1',
  description: 'Database insert contract for sync_metadata table',
  schema: Schemas.SyncMetadataInsertSchema,
})

// =============================================================================
// TicketComments Contracts
// =============================================================================

/**
 * Contract for ticketComments row (Select)
 * Database table: ticket_comments
 */
export const TicketCommentsRowContract = createContract({
  name: 'TicketCommentsRow',
  version: '1',
  description: 'Database row contract for ticket_comments table',
  schema: Schemas.TicketCommentsSelectSchema,
})

/**
 * Contract for ticketComments insert
 * Database table: ticket_comments
 */
export const TicketCommentsInsertContract = createContract({
  name: 'TicketCommentsInsert',
  version: '1',
  description: 'Database insert contract for ticket_comments table',
  schema: Schemas.TicketCommentsInsertSchema,
})

// =============================================================================
// TicketLabelAssignments Contracts
// =============================================================================

/**
 * Contract for ticketLabelAssignments row (Select)
 * Database table: ticket_label_assignments
 */
export const TicketLabelAssignmentsRowContract = createContract({
  name: 'TicketLabelAssignmentsRow',
  version: '1',
  description: 'Database row contract for ticket_label_assignments table',
  schema: Schemas.TicketLabelAssignmentsSelectSchema,
})

/**
 * Contract for ticketLabelAssignments insert
 * Database table: ticket_label_assignments
 */
export const TicketLabelAssignmentsInsertContract = createContract({
  name: 'TicketLabelAssignmentsInsert',
  version: '1',
  description: 'Database insert contract for ticket_label_assignments table',
  schema: Schemas.TicketLabelAssignmentsInsertSchema,
})

// =============================================================================
// TicketLabels Contracts
// =============================================================================

/**
 * Contract for ticketLabels row (Select)
 * Database table: ticket_labels
 */
export const TicketLabelsRowContract = createContract({
  name: 'TicketLabelsRow',
  version: '1',
  description: 'Database row contract for ticket_labels table',
  schema: Schemas.TicketLabelsSelectSchema,
})

/**
 * Contract for ticketLabels insert
 * Database table: ticket_labels
 */
export const TicketLabelsInsertContract = createContract({
  name: 'TicketLabelsInsert',
  version: '1',
  description: 'Database insert contract for ticket_labels table',
  schema: Schemas.TicketLabelsInsertSchema,
})

// =============================================================================
// Tickets Contracts
// =============================================================================

/**
 * Contract for tickets row (Select)
 * Database table: tickets
 */
export const TicketsRowContract = createContract({
  name: 'TicketsRow',
  version: '1',
  description: 'Database row contract for tickets table',
  schema: Schemas.TicketsSelectSchema,
})

/**
 * Contract for tickets insert
 * Database table: tickets
 */
export const TicketsInsertContract = createContract({
  name: 'TicketsInsert',
  version: '1',
  description: 'Database insert contract for tickets table',
  schema: Schemas.TicketsInsertSchema,
})

// =============================================================================
// UserDevices Contracts
// =============================================================================

/**
 * Contract for userDevices row (Select)
 * Database table: user_devices
 */
export const UserDevicesRowContract = createContract({
  name: 'UserDevicesRow',
  version: '1',
  description: 'Database row contract for user_devices table',
  schema: Schemas.UserDevicesSelectSchema,
})

/**
 * Contract for userDevices insert
 * Database table: user_devices
 */
export const UserDevicesInsertContract = createContract({
  name: 'UserDevicesInsert',
  version: '1',
  description: 'Database insert contract for user_devices table',
  schema: Schemas.UserDevicesInsertSchema,
})

// =============================================================================
// Users Contracts
// =============================================================================

/**
 * Contract for users row (Select)
 * Database table: users
 */
export const UsersRowContract = createContract({
  name: 'UsersRow',
  version: '1',
  description: 'Database row contract for users table',
  schema: Schemas.UsersSelectSchema,
})

/**
 * Contract for users insert
 * Database table: users
 */
export const UsersInsertContract = createContract({
  name: 'UsersInsert',
  version: '1',
  description: 'Database insert contract for users table',
  schema: Schemas.UsersInsertSchema,
})

// =============================================================================
// Waitlist Contracts
// =============================================================================

/**
 * Contract for waitlist row (Select)
 * Database table: waitlist
 */
export const WaitlistRowContract = createContract({
  name: 'WaitlistRow',
  version: '1',
  description: 'Database row contract for waitlist table',
  schema: Schemas.WaitlistSelectSchema,
})

/**
 * Contract for waitlist insert
 * Database table: waitlist
 */
export const WaitlistInsertContract = createContract({
  name: 'WaitlistInsert',
  version: '1',
  description: 'Database insert contract for waitlist table',
  schema: Schemas.WaitlistInsertSchema,
})

// =============================================================================
// YjsDocuments Contracts
// =============================================================================

/**
 * Contract for yjsDocuments row (Select)
 * Database table: yjs_documents
 */
export const YjsDocumentsRowContract = createContract({
  name: 'YjsDocumentsRow',
  version: '1',
  description: 'Database row contract for yjs_documents table',
  schema: Schemas.YjsDocumentsSelectSchema,
})

/**
 * Contract for yjsDocuments insert
 * Database table: yjs_documents
 */
export const YjsDocumentsInsertContract = createContract({
  name: 'YjsDocumentsInsert',
  version: '1',
  description: 'Database insert contract for yjs_documents table',
  schema: Schemas.YjsDocumentsInsertSchema,
})
