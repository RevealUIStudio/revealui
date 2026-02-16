/**
 * @revealui/db/schema - Database Schema (Schema/Server-side)
 *
 * Drizzle ORM table definitions derived from @revealui/contracts Zod schemas.
 * Designed for Neon Postgres with pgvector extension for embeddings.
 *
 * The tables mirror the following Zod schemas:
 * - UserSchema, SessionSchema → users, sessions
 * - SiteSchema → sites, siteCollaborators
 * - PageSchema → pages, pageRevisions
 * - AgentContextSchema, AgentMemorySchema, etc. → agent tables
 *
 * This file re-exports both REST and Vector schemas for backward compatibility.
 * For dual database architecture, use:
 * - `@revealui/db/schema/rest` for REST API schemas (NeonDB)
 * - `@revealui/db/schema/vector` for Vector schemas (Supabase)
 */

// Re-export everything for backward compatibility
export * from './rest.js'
export * from './vector.js'

// Note: We don't export * from './agents.js' to avoid duplicate agentMemories export
// agentMemories is already exported via './vector'
// Other agent tables and types are exported via './rest'
// If you need AgentMemory types, import from '@revealui/db/schema/vector' or '@revealui/contracts/agents'

// =============================================================================
// Relations (defined separately to avoid circular imports)
// =============================================================================

import { relations } from 'drizzle-orm'
import { agentActions, agentContexts, agentMemories, conversations } from './agents.js'
import { auditLog } from './audit-log.js'
import { media, posts } from './cms.js'
import { licenses } from './licenses.js'
import { pageRevisions, pages } from './pages.js'
import { passwordResetTokens } from './password-reset-tokens.js'
import { siteCollaborators, sites } from './sites.js'
import {
  boardColumns,
  boards,
  ticketComments,
  ticketLabelAssignments,
  ticketLabels,
  tickets,
} from './tickets.js'
import { sessions, users } from './users.js'

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  ownedSites: many(sites),
  collaborations: many(siteCollaborators),
  pageRevisions: many(pageRevisions),
  conversations: many(conversations),
}))

// Session relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

// Password reset token relations
export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}))

// Site relations
// Note: memories relation removed - agentMemories is in vector database (Supabase)
// Use VectorMemoryService to query memories by siteId
export const sitesRelations = relations(sites, ({ one, many }) => ({
  owner: one(users, {
    fields: [sites.ownerId],
    references: [users.id],
  }),
  collaborators: many(siteCollaborators),
  pages: many(pages),
}))

// Site collaborator relations
export const siteCollaboratorsRelations = relations(siteCollaborators, ({ one }) => ({
  site: one(sites, {
    fields: [siteCollaborators.siteId],
    references: [sites.id],
  }),
  user: one(users, {
    fields: [siteCollaborators.userId],
    references: [users.id],
  }),
  addedByUser: one(users, {
    fields: [siteCollaborators.addedBy],
    references: [users.id],
  }),
}))

// Page relations
export const pagesRelations = relations(pages, ({ one, many }) => ({
  site: one(sites, {
    fields: [pages.siteId],
    references: [sites.id],
  }),
  parent: one(pages, {
    fields: [pages.parentId],
    references: [pages.id],
    relationName: 'parent',
  }),
  children: many(pages, {
    relationName: 'parent',
  }),
  revisions: many(pageRevisions),
}))

// Page revision relations
export const pageRevisionsRelations = relations(pageRevisions, ({ one }) => ({
  page: one(pages, {
    fields: [pageRevisions.pageId],
    references: [pages.id],
  }),
  createdByUser: one(users, {
    fields: [pageRevisions.createdBy],
    references: [users.id],
  }),
}))

// Agent context relations
export const agentContextsRelations = relations(agentContexts, () => ({
  // Contexts are loosely coupled via sessionId/agentId strings
}))

// Agent memory relations
export const agentMemoriesRelations = relations(agentMemories, ({ one }) => ({
  site: one(sites, {
    fields: [agentMemories.siteId],
    references: [sites.id],
  }),
  verifiedByUser: one(users, {
    fields: [agentMemories.verifiedBy],
    references: [users.id],
  }),
}))

// Conversation relations
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  actions: many(agentActions),
}))

// Agent action relations
export const agentActionsRelations = relations(agentActions, ({ one }) => ({
  conversation: one(conversations, {
    fields: [agentActions.conversationId],
    references: [conversations.id],
  }),
}))

// =============================================================================
// CMS Relations
// =============================================================================

// Post relations
export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  featuredImage: one(media, {
    fields: [posts.featuredImageId],
    references: [media.id],
  }),
}))

// Media relations
export const mediaRelations = relations(media, ({ one }) => ({
  uploadedByUser: one(users, {
    fields: [media.uploadedBy],
    references: [users.id],
  }),
}))

// =============================================================================
// License Relations
// =============================================================================

export const licensesRelations = relations(licenses, ({ one }) => ({
  user: one(users, {
    fields: [licenses.userId],
    references: [users.id],
  }),
}))

// =============================================================================
// Audit Log Relations
// =============================================================================

// Audit log entries are standalone — no foreign keys by design.
// The agentId, taskId, and sessionId are stored as plain text for
// decoupling the audit trail from agent lifecycle tables.
export const auditLogRelations = relations(auditLog, () => ({}))

// =============================================================================
// Ticketing System Relations
// =============================================================================

export const boardsRelations = relations(boards, ({ one, many }) => ({
  owner: one(users, {
    fields: [boards.ownerId],
    references: [users.id],
  }),
  columns: many(boardColumns),
  tickets: many(tickets),
}))

export const boardColumnsRelations = relations(boardColumns, ({ one, many }) => ({
  board: one(boards, {
    fields: [boardColumns.boardId],
    references: [boards.id],
  }),
  tickets: many(tickets),
}))

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  board: one(boards, {
    fields: [tickets.boardId],
    references: [boards.id],
  }),
  column: one(boardColumns, {
    fields: [tickets.columnId],
    references: [boardColumns.id],
  }),
  assignee: one(users, {
    fields: [tickets.assigneeId],
    references: [users.id],
    relationName: 'assignedTickets',
  }),
  reporter: one(users, {
    fields: [tickets.reporterId],
    references: [users.id],
    relationName: 'reportedTickets',
  }),
  parent: one(tickets, {
    fields: [tickets.parentTicketId],
    references: [tickets.id],
    relationName: 'subtasks',
  }),
  children: many(tickets, {
    relationName: 'subtasks',
  }),
  comments: many(ticketComments),
  labelAssignments: many(ticketLabelAssignments),
}))

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketComments.ticketId],
    references: [tickets.id],
  }),
  author: one(users, {
    fields: [ticketComments.authorId],
    references: [users.id],
  }),
}))

export const ticketLabelsRelations = relations(ticketLabels, ({ many }) => ({
  assignments: many(ticketLabelAssignments),
}))

export const ticketLabelAssignmentsRelations = relations(ticketLabelAssignments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketLabelAssignments.ticketId],
    references: [tickets.id],
  }),
  label: one(ticketLabels, {
    fields: [ticketLabelAssignments.labelId],
    references: [ticketLabels.id],
  }),
}))
