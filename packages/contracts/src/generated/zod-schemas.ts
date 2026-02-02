/**
 * Auto-generated Zod schemas from Drizzle
 *
 * DO NOT EDIT - Regenerate with: pnpm generate:all
 * Generated: 2026-02-02T12:04:44.003Z
 *
 * This file provides Zod schemas for all database tables, generated
 * directly from Drizzle table definitions using drizzle-zod.
 * These schemas are used for runtime validation and form the base
 * for entity contracts in @revealui/contracts/entities.
 */

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import type { z } from 'zod/v4'
import * as tables from '@revealui/db/schema'

// =============================================================================
// AgentActions Schemas
// =============================================================================

/**
 * Zod schema for selecting agentActions rows from database
 * Generated from Drizzle table definition: tables.agentActions
 */
export const AgentActionsSelectSchema = createSelectSchema(tables.agentActions)

/**
 * Zod schema for inserting agentActions rows to database
 * Generated from Drizzle table definition: tables.agentActions
 */
export const AgentActionsInsertSchema = createInsertSchema(tables.agentActions)

/**
 * TypeScript type for agentActions row (Select)
 */
export type AgentActionsRow = z.infer<typeof AgentActionsSelectSchema>

/**
 * TypeScript type for agentActions insert
 */
export type AgentActionsInsert = z.infer<typeof AgentActionsInsertSchema>

// =============================================================================
// AgentContexts Schemas
// =============================================================================

/**
 * Zod schema for selecting agentContexts rows from database
 * Generated from Drizzle table definition: tables.agentContexts
 */
export const AgentContextsSelectSchema = createSelectSchema(tables.agentContexts)

/**
 * Zod schema for inserting agentContexts rows to database
 * Generated from Drizzle table definition: tables.agentContexts
 */
export const AgentContextsInsertSchema = createInsertSchema(tables.agentContexts)

/**
 * TypeScript type for agentContexts row (Select)
 */
export type AgentContextsRow = z.infer<typeof AgentContextsSelectSchema>

/**
 * TypeScript type for agentContexts insert
 */
export type AgentContextsInsert = z.infer<typeof AgentContextsInsertSchema>

// =============================================================================
// AgentMemories Schemas
// =============================================================================

/**
 * Zod schema for selecting agentMemories rows from database
 * Generated from Drizzle table definition: tables.agentMemories
 */
export const AgentMemoriesSelectSchema = createSelectSchema(tables.agentMemories)

/**
 * Zod schema for inserting agentMemories rows to database
 * Generated from Drizzle table definition: tables.agentMemories
 */
export const AgentMemoriesInsertSchema = createInsertSchema(tables.agentMemories)

/**
 * TypeScript type for agentMemories row (Select)
 */
export type AgentMemoriesRow = z.infer<typeof AgentMemoriesSelectSchema>

/**
 * TypeScript type for agentMemories insert
 */
export type AgentMemoriesInsert = z.infer<typeof AgentMemoriesInsertSchema>

// =============================================================================
// Conversations Schemas
// =============================================================================

/**
 * Zod schema for selecting conversations rows from database
 * Generated from Drizzle table definition: tables.conversations
 */
export const ConversationsSelectSchema = createSelectSchema(tables.conversations)

/**
 * Zod schema for inserting conversations rows to database
 * Generated from Drizzle table definition: tables.conversations
 */
export const ConversationsInsertSchema = createInsertSchema(tables.conversations)

/**
 * TypeScript type for conversations row (Select)
 */
export type ConversationsRow = z.infer<typeof ConversationsSelectSchema>

/**
 * TypeScript type for conversations insert
 */
export type ConversationsInsert = z.infer<typeof ConversationsInsertSchema>

// =============================================================================
// CrdtOperations Schemas
// =============================================================================

/**
 * Zod schema for selecting crdtOperations rows from database
 * Generated from Drizzle table definition: tables.crdtOperations
 */
export const CrdtOperationsSelectSchema = createSelectSchema(tables.crdtOperations)

/**
 * Zod schema for inserting crdtOperations rows to database
 * Generated from Drizzle table definition: tables.crdtOperations
 */
export const CrdtOperationsInsertSchema = createInsertSchema(tables.crdtOperations)

/**
 * TypeScript type for crdtOperations row (Select)
 */
export type CrdtOperationsRow = z.infer<typeof CrdtOperationsSelectSchema>

/**
 * TypeScript type for crdtOperations insert
 */
export type CrdtOperationsInsert = z.infer<typeof CrdtOperationsInsertSchema>

// =============================================================================
// FailedAttempts Schemas
// =============================================================================

/**
 * Zod schema for selecting failedAttempts rows from database
 * Generated from Drizzle table definition: tables.failedAttempts
 */
export const FailedAttemptsSelectSchema = createSelectSchema(tables.failedAttempts)

/**
 * Zod schema for inserting failedAttempts rows to database
 * Generated from Drizzle table definition: tables.failedAttempts
 */
export const FailedAttemptsInsertSchema = createInsertSchema(tables.failedAttempts)

/**
 * TypeScript type for failedAttempts row (Select)
 */
export type FailedAttemptsRow = z.infer<typeof FailedAttemptsSelectSchema>

/**
 * TypeScript type for failedAttempts insert
 */
export type FailedAttemptsInsert = z.infer<typeof FailedAttemptsInsertSchema>

// =============================================================================
// GlobalFooter Schemas
// =============================================================================

/**
 * Zod schema for selecting globalFooter rows from database
 * Generated from Drizzle table definition: tables.globalFooter
 */
export const GlobalFooterSelectSchema = createSelectSchema(tables.globalFooter)

/**
 * Zod schema for inserting globalFooter rows to database
 * Generated from Drizzle table definition: tables.globalFooter
 */
export const GlobalFooterInsertSchema = createInsertSchema(tables.globalFooter)

/**
 * TypeScript type for globalFooter row (Select)
 */
export type GlobalFooterRow = z.infer<typeof GlobalFooterSelectSchema>

/**
 * TypeScript type for globalFooter insert
 */
export type GlobalFooterInsert = z.infer<typeof GlobalFooterInsertSchema>

// =============================================================================
// GlobalHeader Schemas
// =============================================================================

/**
 * Zod schema for selecting globalHeader rows from database
 * Generated from Drizzle table definition: tables.globalHeader
 */
export const GlobalHeaderSelectSchema = createSelectSchema(tables.globalHeader)

/**
 * Zod schema for inserting globalHeader rows to database
 * Generated from Drizzle table definition: tables.globalHeader
 */
export const GlobalHeaderInsertSchema = createInsertSchema(tables.globalHeader)

/**
 * TypeScript type for globalHeader row (Select)
 */
export type GlobalHeaderRow = z.infer<typeof GlobalHeaderSelectSchema>

/**
 * TypeScript type for globalHeader insert
 */
export type GlobalHeaderInsert = z.infer<typeof GlobalHeaderInsertSchema>

// =============================================================================
// GlobalSettings Schemas
// =============================================================================

/**
 * Zod schema for selecting globalSettings rows from database
 * Generated from Drizzle table definition: tables.globalSettings
 */
export const GlobalSettingsSelectSchema = createSelectSchema(tables.globalSettings)

/**
 * Zod schema for inserting globalSettings rows to database
 * Generated from Drizzle table definition: tables.globalSettings
 */
export const GlobalSettingsInsertSchema = createInsertSchema(tables.globalSettings)

/**
 * TypeScript type for globalSettings row (Select)
 */
export type GlobalSettingsRow = z.infer<typeof GlobalSettingsSelectSchema>

/**
 * TypeScript type for globalSettings insert
 */
export type GlobalSettingsInsert = z.infer<typeof GlobalSettingsInsertSchema>

// =============================================================================
// Media Schemas
// =============================================================================

/**
 * Zod schema for selecting media rows from database
 * Generated from Drizzle table definition: tables.media
 */
export const MediaSelectSchema = createSelectSchema(tables.media)

/**
 * Zod schema for inserting media rows to database
 * Generated from Drizzle table definition: tables.media
 */
export const MediaInsertSchema = createInsertSchema(tables.media)

/**
 * TypeScript type for media row (Select)
 */
export type MediaRow = z.infer<typeof MediaSelectSchema>

/**
 * TypeScript type for media insert
 */
export type MediaInsert = z.infer<typeof MediaInsertSchema>

// =============================================================================
// Messages Schemas
// =============================================================================

/**
 * Zod schema for selecting messages rows from database
 * Generated from Drizzle table definition: tables.messages
 */
export const MessagesSelectSchema = createSelectSchema(tables.messages)

/**
 * Zod schema for inserting messages rows to database
 * Generated from Drizzle table definition: tables.messages
 */
export const MessagesInsertSchema = createInsertSchema(tables.messages)

/**
 * TypeScript type for messages row (Select)
 */
export type MessagesRow = z.infer<typeof MessagesSelectSchema>

/**
 * TypeScript type for messages insert
 */
export type MessagesInsert = z.infer<typeof MessagesInsertSchema>

// =============================================================================
// NodeIdMappings Schemas
// =============================================================================

/**
 * Zod schema for selecting nodeIdMappings rows from database
 * Generated from Drizzle table definition: tables.nodeIdMappings
 */
export const NodeIdMappingsSelectSchema = createSelectSchema(tables.nodeIdMappings)

/**
 * Zod schema for inserting nodeIdMappings rows to database
 * Generated from Drizzle table definition: tables.nodeIdMappings
 */
export const NodeIdMappingsInsertSchema = createInsertSchema(tables.nodeIdMappings)

/**
 * TypeScript type for nodeIdMappings row (Select)
 */
export type NodeIdMappingsRow = z.infer<typeof NodeIdMappingsSelectSchema>

/**
 * TypeScript type for nodeIdMappings insert
 */
export type NodeIdMappingsInsert = z.infer<typeof NodeIdMappingsInsertSchema>

// =============================================================================
// PageRevisions Schemas
// =============================================================================

/**
 * Zod schema for selecting pageRevisions rows from database
 * Generated from Drizzle table definition: tables.pageRevisions
 */
export const PageRevisionsSelectSchema = createSelectSchema(tables.pageRevisions)

/**
 * Zod schema for inserting pageRevisions rows to database
 * Generated from Drizzle table definition: tables.pageRevisions
 */
export const PageRevisionsInsertSchema = createInsertSchema(tables.pageRevisions)

/**
 * TypeScript type for pageRevisions row (Select)
 */
export type PageRevisionsRow = z.infer<typeof PageRevisionsSelectSchema>

/**
 * TypeScript type for pageRevisions insert
 */
export type PageRevisionsInsert = z.infer<typeof PageRevisionsInsertSchema>

// =============================================================================
// Pages Schemas
// =============================================================================

/**
 * Zod schema for selecting pages rows from database
 * Generated from Drizzle table definition: tables.pages
 */
export const PagesSelectSchema = createSelectSchema(tables.pages)

/**
 * Zod schema for inserting pages rows to database
 * Generated from Drizzle table definition: tables.pages
 */
export const PagesInsertSchema = createInsertSchema(tables.pages)

/**
 * TypeScript type for pages row (Select)
 */
export type PagesRow = z.infer<typeof PagesSelectSchema>

/**
 * TypeScript type for pages insert
 */
export type PagesInsert = z.infer<typeof PagesInsertSchema>

// =============================================================================
// PasswordResetTokens Schemas
// =============================================================================

/**
 * Zod schema for selecting passwordResetTokens rows from database
 * Generated from Drizzle table definition: tables.passwordResetTokens
 */
export const PasswordResetTokensSelectSchema = createSelectSchema(tables.passwordResetTokens)

/**
 * Zod schema for inserting passwordResetTokens rows to database
 * Generated from Drizzle table definition: tables.passwordResetTokens
 */
export const PasswordResetTokensInsertSchema = createInsertSchema(tables.passwordResetTokens)

/**
 * TypeScript type for passwordResetTokens row (Select)
 */
export type PasswordResetTokensRow = z.infer<typeof PasswordResetTokensSelectSchema>

/**
 * TypeScript type for passwordResetTokens insert
 */
export type PasswordResetTokensInsert = z.infer<typeof PasswordResetTokensInsertSchema>

// =============================================================================
// Posts Schemas
// =============================================================================

/**
 * Zod schema for selecting posts rows from database
 * Generated from Drizzle table definition: tables.posts
 */
export const PostsSelectSchema = createSelectSchema(tables.posts)

/**
 * Zod schema for inserting posts rows to database
 * Generated from Drizzle table definition: tables.posts
 */
export const PostsInsertSchema = createInsertSchema(tables.posts)

/**
 * TypeScript type for posts row (Select)
 */
export type PostsRow = z.infer<typeof PostsSelectSchema>

/**
 * TypeScript type for posts insert
 */
export type PostsInsert = z.infer<typeof PostsInsertSchema>

// =============================================================================
// RateLimits Schemas
// =============================================================================

/**
 * Zod schema for selecting rateLimits rows from database
 * Generated from Drizzle table definition: tables.rateLimits
 */
export const RateLimitsSelectSchema = createSelectSchema(tables.rateLimits)

/**
 * Zod schema for inserting rateLimits rows to database
 * Generated from Drizzle table definition: tables.rateLimits
 */
export const RateLimitsInsertSchema = createInsertSchema(tables.rateLimits)

/**
 * TypeScript type for rateLimits row (Select)
 */
export type RateLimitsRow = z.infer<typeof RateLimitsSelectSchema>

/**
 * TypeScript type for rateLimits insert
 */
export type RateLimitsInsert = z.infer<typeof RateLimitsInsertSchema>

// =============================================================================
// Sessions Schemas
// =============================================================================

/**
 * Zod schema for selecting sessions rows from database
 * Generated from Drizzle table definition: tables.sessions
 */
export const SessionsSelectSchema = createSelectSchema(tables.sessions)

/**
 * Zod schema for inserting sessions rows to database
 * Generated from Drizzle table definition: tables.sessions
 */
export const SessionsInsertSchema = createInsertSchema(tables.sessions)

/**
 * TypeScript type for sessions row (Select)
 */
export type SessionsRow = z.infer<typeof SessionsSelectSchema>

/**
 * TypeScript type for sessions insert
 */
export type SessionsInsert = z.infer<typeof SessionsInsertSchema>

// =============================================================================
// SiteCollaborators Schemas
// =============================================================================

/**
 * Zod schema for selecting siteCollaborators rows from database
 * Generated from Drizzle table definition: tables.siteCollaborators
 */
export const SiteCollaboratorsSelectSchema = createSelectSchema(tables.siteCollaborators)

/**
 * Zod schema for inserting siteCollaborators rows to database
 * Generated from Drizzle table definition: tables.siteCollaborators
 */
export const SiteCollaboratorsInsertSchema = createInsertSchema(tables.siteCollaborators)

/**
 * TypeScript type for siteCollaborators row (Select)
 */
export type SiteCollaboratorsRow = z.infer<typeof SiteCollaboratorsSelectSchema>

/**
 * TypeScript type for siteCollaborators insert
 */
export type SiteCollaboratorsInsert = z.infer<typeof SiteCollaboratorsInsertSchema>

// =============================================================================
// Sites Schemas
// =============================================================================

/**
 * Zod schema for selecting sites rows from database
 * Generated from Drizzle table definition: tables.sites
 */
export const SitesSelectSchema = createSelectSchema(tables.sites)

/**
 * Zod schema for inserting sites rows to database
 * Generated from Drizzle table definition: tables.sites
 */
export const SitesInsertSchema = createInsertSchema(tables.sites)

/**
 * TypeScript type for sites row (Select)
 */
export type SitesRow = z.infer<typeof SitesSelectSchema>

/**
 * TypeScript type for sites insert
 */
export type SitesInsert = z.infer<typeof SitesInsertSchema>

// =============================================================================
// SyncMetadata Schemas
// =============================================================================

/**
 * Zod schema for selecting syncMetadata rows from database
 * Generated from Drizzle table definition: tables.syncMetadata
 */
export const SyncMetadataSelectSchema = createSelectSchema(tables.syncMetadata)

/**
 * Zod schema for inserting syncMetadata rows to database
 * Generated from Drizzle table definition: tables.syncMetadata
 */
export const SyncMetadataInsertSchema = createInsertSchema(tables.syncMetadata)

/**
 * TypeScript type for syncMetadata row (Select)
 */
export type SyncMetadataRow = z.infer<typeof SyncMetadataSelectSchema>

/**
 * TypeScript type for syncMetadata insert
 */
export type SyncMetadataInsert = z.infer<typeof SyncMetadataInsertSchema>

// =============================================================================
// UserDevices Schemas
// =============================================================================

/**
 * Zod schema for selecting userDevices rows from database
 * Generated from Drizzle table definition: tables.userDevices
 */
export const UserDevicesSelectSchema = createSelectSchema(tables.userDevices)

/**
 * Zod schema for inserting userDevices rows to database
 * Generated from Drizzle table definition: tables.userDevices
 */
export const UserDevicesInsertSchema = createInsertSchema(tables.userDevices)

/**
 * TypeScript type for userDevices row (Select)
 */
export type UserDevicesRow = z.infer<typeof UserDevicesSelectSchema>

/**
 * TypeScript type for userDevices insert
 */
export type UserDevicesInsert = z.infer<typeof UserDevicesInsertSchema>

// =============================================================================
// Users Schemas
// =============================================================================

/**
 * Zod schema for selecting users rows from database
 * Generated from Drizzle table definition: tables.users
 */
export const UsersSelectSchema = createSelectSchema(tables.users)

/**
 * Zod schema for inserting users rows to database
 * Generated from Drizzle table definition: tables.users
 */
export const UsersInsertSchema = createInsertSchema(tables.users)

/**
 * TypeScript type for users row (Select)
 */
export type UsersRow = z.infer<typeof UsersSelectSchema>

/**
 * TypeScript type for users insert
 */
export type UsersInsert = z.infer<typeof UsersInsertSchema>
