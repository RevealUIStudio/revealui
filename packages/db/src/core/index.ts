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
export * from './rest'
export * from './vector'

// Note: We don't export * from './agents' to avoid duplicate agentMemories export
// agentMemories is already exported via './vector'
// Other agent tables and types are exported via './rest'
// If you need AgentMemory types, import from '@revealui/db/schema/vector' or '@revealui/contracts/agents'

// =============================================================================
// Relations (defined separately to avoid circular imports)
// =============================================================================

import { relations } from 'drizzle-orm'
import { agentActions, agentContexts, agentMemories, conversations } from './agents'
import { media, posts } from './cms'
import { pageRevisions, pages } from './pages'
import { passwordResetTokens } from './password-reset-tokens'
import { siteCollaborators, sites } from './sites'
import { sessions, users } from './users'

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
