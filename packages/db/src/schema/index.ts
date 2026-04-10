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

// Re-export Drizzle query operators for compatibility with @revealui/ai which
// imports them from this module. These belong in drizzle-orm but are shimmed
// here to avoid a breaking change in the published package.
export {
  and,
  asc,
  between,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  not,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
// Re-export everything for backward compatibility
export * from './rest.js';
export * from './vector.js';

// Note: We don't export * from './agents.js' to avoid duplicate exports.
// agentMemories is exported via './rest' (it lives in NeonDB due to FK constraints).
// Other agent tables and types are also exported via './rest'.
// RAG tables are exported via './vector' (they live in Supabase).

// =============================================================================
// Relations (defined separately to avoid circular imports)
// =============================================================================

import { relations } from 'drizzle-orm';
import {
  accountEntitlements,
  accountMemberships,
  accountSubscriptions,
  accounts,
  usageMeters,
} from './accounts.js';
import { media, posts } from './admin.js';
import { agentActions, agentContexts, agentMemories, conversations } from './agents.js';
import { tenantProviderConfigs, userApiKeys } from './api-keys.js';
import { appLogs } from './app-logs.js';
import { auditLog } from './audit-log.js';
import { codeProvenance, codeReviews } from './code-provenance.js';
import { collabEdits } from './collab-edits.js';
import { errorEvents } from './error-events.js';
import { licenses } from './licenses.js';
import { magicLinks } from './magic-links.js';
import { marketplaceServers, marketplaceTransactions } from './marketplace.js';
import { oauthAccounts } from './oauth-accounts.js';
import { pageRevisions, pages } from './pages.js';
import { passkeys } from './passkeys.js';
import { passwordResetTokens } from './password-reset-tokens.js';
import { orders, products } from './products.js';
import { agentReviews, agentSkills, marketplaceAgents, taskSubmissions } from './revmarket.js';
import { siteCollaborators, sites } from './sites.js';
import { tenants } from './tenants.js';
import {
  boardColumns,
  boards,
  ticketComments,
  ticketLabelAssignments,
  ticketLabels,
  tickets,
} from './tickets.js';
import { sessions, users } from './users.js';
import { yjsDocuments } from './yjs-documents.js';

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  accountMemberships: many(accountMemberships),
  sessions: many(sessions),
  ownedSites: many(sites),
  collaborations: many(siteCollaborators),
  pageRevisions: many(pageRevisions),
  conversations: many(conversations),
  apiKeys: many(userApiKeys),
  providerConfigs: many(tenantProviderConfigs),
  oauthAccounts: many(oauthAccounts),
  passkeys: many(passkeys),
  magicLinks: many(magicLinks),
}));

export const tenantsRelations = relations(tenants, () => ({}));

export const accountsRelations = relations(accounts, ({ many, one }) => ({
  memberships: many(accountMemberships),
  subscriptions: many(accountSubscriptions),
  entitlements: one(accountEntitlements),
  usageMeters: many(usageMeters),
}));

export const accountMembershipsRelations = relations(accountMemberships, ({ one }) => ({
  account: one(accounts, {
    fields: [accountMemberships.accountId],
    references: [accounts.id],
  }),
  user: one(users, {
    fields: [accountMemberships.userId],
    references: [users.id],
  }),
}));

export const accountSubscriptionsRelations = relations(accountSubscriptions, ({ one }) => ({
  account: one(accounts, {
    fields: [accountSubscriptions.accountId],
    references: [accounts.id],
  }),
}));

export const accountEntitlementsRelations = relations(accountEntitlements, ({ one }) => ({
  account: one(accounts, {
    fields: [accountEntitlements.accountId],
    references: [accounts.id],
  }),
}));

export const usageMetersRelations = relations(usageMeters, ({ one }) => ({
  account: one(accounts, {
    fields: [usageMeters.accountId],
    references: [accounts.id],
  }),
}));

// OAuth account relations
export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id],
  }),
}));

// API key relations
export const userApiKeysRelations = relations(userApiKeys, ({ one }) => ({
  user: one(users, {
    fields: [userApiKeys.userId],
    references: [users.id],
  }),
}));

export const tenantProviderConfigsRelations = relations(tenantProviderConfigs, ({ one }) => ({
  user: one(users, {
    fields: [tenantProviderConfigs.userId],
    references: [users.id],
  }),
}));

// Session relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// Password reset token relations
export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

// Passkey relations
export const passkeysRelations = relations(passkeys, ({ one }) => ({
  user: one(users, {
    fields: [passkeys.userId],
    references: [users.id],
  }),
}));

// Magic link relations
export const magicLinksRelations = relations(magicLinks, ({ one }) => ({
  user: one(users, {
    fields: [magicLinks.userId],
    references: [users.id],
  }),
}));

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
}));

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
}));

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
}));

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
}));

// Agent context relations
export const agentContextsRelations = relations(agentContexts, () => ({
  // Contexts are loosely coupled via sessionId/agentId strings
}));

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
}));

// Conversation relations
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  actions: many(agentActions),
}));

// Agent action relations
export const agentActionsRelations = relations(agentActions, ({ one }) => ({
  conversation: one(conversations, {
    fields: [agentActions.conversationId],
    references: [conversations.id],
  }),
}));

// =============================================================================
// admin Relations
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
}));

// Media relations
export const mediaRelations = relations(media, ({ one }) => ({
  uploadedByUser: one(users, {
    fields: [media.uploadedBy],
    references: [users.id],
  }),
}));

// =============================================================================
// Product & Order Relations
// =============================================================================

export const productsRelations = relations(products, ({ one }) => ({
  owner: one(users, {
    fields: [products.ownerId],
    references: [users.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
  }),
}));

// =============================================================================
// License Relations
// =============================================================================

export const licensesRelations = relations(licenses, ({ one }) => ({
  user: one(users, {
    fields: [licenses.userId],
    references: [users.id],
  }),
}));

// =============================================================================
// Audit Log Relations
// =============================================================================

// Audit log entries are standalone — no foreign keys by design.
// The agentId, taskId, and sessionId are stored as plain text for
// decoupling the audit trail from agent lifecycle tables.
export const auditLogRelations = relations(auditLog, () => ({}));

// App logs are standalone — no foreign keys by design.
// Append-only structured log store (warn+ in production).
export const appLogsRelations = relations(appLogs, () => ({}));

// Error events are standalone — no foreign keys by design.
// userId is stored as plain text so errors outlive user deletion.
export const errorEventsRelations = relations(errorEvents, () => ({}));

// =============================================================================
// Collaborative Editing Relations
// =============================================================================

export const yjsDocumentsRelations = relations(yjsDocuments, ({ many }) => ({
  edits: many(collabEdits),
}));

export const collabEditsRelations = relations(collabEdits, ({ one }) => ({
  document: one(yjsDocuments, {
    fields: [collabEdits.documentId],
    references: [yjsDocuments.id],
  }),
}));

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
}));

export const boardColumnsRelations = relations(boardColumns, ({ one, many }) => ({
  board: one(boards, {
    fields: [boardColumns.boardId],
    references: [boards.id],
  }),
  tickets: many(tickets),
}));

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
}));

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketComments.ticketId],
    references: [tickets.id],
  }),
  author: one(users, {
    fields: [ticketComments.authorId],
    references: [users.id],
  }),
}));

export const ticketLabelsRelations = relations(ticketLabels, ({ many }) => ({
  assignments: many(ticketLabelAssignments),
}));

export const ticketLabelAssignmentsRelations = relations(ticketLabelAssignments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketLabelAssignments.ticketId],
    references: [tickets.id],
  }),
  label: one(ticketLabels, {
    fields: [ticketLabelAssignments.labelId],
    references: [ticketLabels.id],
  }),
}));

// =============================================================================
// Marketplace Relations
// =============================================================================

export const marketplaceServersRelations = relations(marketplaceServers, ({ one, many }) => ({
  developer: one(users, {
    fields: [marketplaceServers.developerId],
    references: [users.id],
  }),
  transactions: many(marketplaceTransactions),
}));

export const marketplaceTransactionsRelations = relations(marketplaceTransactions, ({ one }) => ({
  server: one(marketplaceServers, {
    fields: [marketplaceTransactions.serverId],
    references: [marketplaceServers.id],
  }),
}));

// =============================================================================
// Code Provenance Relations
// =============================================================================

export const codeProvenanceRelations = relations(codeProvenance, ({ one, many }) => ({
  reviewer: one(users, {
    fields: [codeProvenance.reviewedBy],
    references: [users.id],
  }),
  reviews: many(codeReviews),
}));

export const codeReviewsRelations = relations(codeReviews, ({ one }) => ({
  provenance: one(codeProvenance, {
    fields: [codeReviews.provenanceId],
    references: [codeProvenance.id],
  }),
  reviewer: one(users, {
    fields: [codeReviews.reviewerId],
    references: [users.id],
  }),
}));

// =============================================================================
// RevMarket — Autonomous Agent Marketplace Relations
// =============================================================================

export const marketplaceAgentsRelations = relations(marketplaceAgents, ({ one, many }) => ({
  publisher: one(users, {
    fields: [marketplaceAgents.publisherId],
    references: [users.id],
  }),
  skills: many(agentSkills),
  reviews: many(agentReviews),
  tasks: many(taskSubmissions),
}));

export const agentSkillsRelations = relations(agentSkills, ({ one }) => ({
  agent: one(marketplaceAgents, {
    fields: [agentSkills.agentId],
    references: [marketplaceAgents.id],
  }),
}));

export const agentReviewsRelations = relations(agentReviews, ({ one }) => ({
  agent: one(marketplaceAgents, {
    fields: [agentReviews.agentId],
    references: [marketplaceAgents.id],
  }),
  reviewer: one(users, {
    fields: [agentReviews.reviewerId],
    references: [users.id],
  }),
}));

export const taskSubmissionsRelations = relations(taskSubmissions, ({ one }) => ({
  submitter: one(users, {
    fields: [taskSubmissions.submitterId],
    references: [users.id],
  }),
  agent: one(marketplaceAgents, {
    fields: [taskSubmissions.agentId],
    references: [marketplaceAgents.id],
  }),
}));
