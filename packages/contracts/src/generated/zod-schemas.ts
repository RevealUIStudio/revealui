/**
 * Auto-generated Zod schemas from Drizzle
 *
 * DO NOT EDIT - Regenerate with: pnpm generate:all
 * Generated: 2026-03-29T21:40:55.025Z
 *
 * This file provides Zod schemas for all database tables, generated
 * directly from Drizzle table definitions using drizzle-zod.
 * These schemas are used for runtime validation and form the base
 * for entity contracts in @revealui/contracts/entities.
 */

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import type { z } from 'zod'
import * as tables from '@revealui/db/schema'

// =============================================================================
// AccountEntitlements Schemas
// =============================================================================

/**
 * Zod schema for selecting accountEntitlements rows from database
 * Generated from Drizzle table definition: tables.accountEntitlements
 */
export const AccountEntitlementsSelectSchema = createSelectSchema(tables.accountEntitlements)

/**
 * Zod schema for inserting accountEntitlements rows to database
 * Generated from Drizzle table definition: tables.accountEntitlements
 */
export const AccountEntitlementsInsertSchema = createInsertSchema(tables.accountEntitlements)

/**
 * TypeScript type for accountEntitlements row (Select)
 */
export type AccountEntitlementsRow = z.infer<typeof AccountEntitlementsSelectSchema>

/**
 * TypeScript type for accountEntitlements insert
 */
export type AccountEntitlementsInsert = z.infer<typeof AccountEntitlementsInsertSchema>

// =============================================================================
// AccountMemberships Schemas
// =============================================================================

/**
 * Zod schema for selecting accountMemberships rows from database
 * Generated from Drizzle table definition: tables.accountMemberships
 */
export const AccountMembershipsSelectSchema = createSelectSchema(tables.accountMemberships)

/**
 * Zod schema for inserting accountMemberships rows to database
 * Generated from Drizzle table definition: tables.accountMemberships
 */
export const AccountMembershipsInsertSchema = createInsertSchema(tables.accountMemberships)

/**
 * TypeScript type for accountMemberships row (Select)
 */
export type AccountMembershipsRow = z.infer<typeof AccountMembershipsSelectSchema>

/**
 * TypeScript type for accountMemberships insert
 */
export type AccountMembershipsInsert = z.infer<typeof AccountMembershipsInsertSchema>

// =============================================================================
// Accounts Schemas
// =============================================================================

/**
 * Zod schema for selecting accounts rows from database
 * Generated from Drizzle table definition: tables.accounts
 */
export const AccountsSelectSchema = createSelectSchema(tables.accounts)

/**
 * Zod schema for inserting accounts rows to database
 * Generated from Drizzle table definition: tables.accounts
 */
export const AccountsInsertSchema = createInsertSchema(tables.accounts)

/**
 * TypeScript type for accounts row (Select)
 */
export type AccountsRow = z.infer<typeof AccountsSelectSchema>

/**
 * TypeScript type for accounts insert
 */
export type AccountsInsert = z.infer<typeof AccountsInsertSchema>

// =============================================================================
// AccountSubscriptions Schemas
// =============================================================================

/**
 * Zod schema for selecting accountSubscriptions rows from database
 * Generated from Drizzle table definition: tables.accountSubscriptions
 */
export const AccountSubscriptionsSelectSchema = createSelectSchema(tables.accountSubscriptions)

/**
 * Zod schema for inserting accountSubscriptions rows to database
 * Generated from Drizzle table definition: tables.accountSubscriptions
 */
export const AccountSubscriptionsInsertSchema = createInsertSchema(tables.accountSubscriptions)

/**
 * TypeScript type for accountSubscriptions row (Select)
 */
export type AccountSubscriptionsRow = z.infer<typeof AccountSubscriptionsSelectSchema>

/**
 * TypeScript type for accountSubscriptions insert
 */
export type AccountSubscriptionsInsert = z.infer<typeof AccountSubscriptionsInsertSchema>

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
// AgentCreditBalance Schemas
// =============================================================================

/**
 * Zod schema for selecting agentCreditBalance rows from database
 * Generated from Drizzle table definition: tables.agentCreditBalance
 */
export const AgentCreditBalanceSelectSchema = createSelectSchema(tables.agentCreditBalance)

/**
 * Zod schema for inserting agentCreditBalance rows to database
 * Generated from Drizzle table definition: tables.agentCreditBalance
 */
export const AgentCreditBalanceInsertSchema = createInsertSchema(tables.agentCreditBalance)

/**
 * TypeScript type for agentCreditBalance row (Select)
 */
export type AgentCreditBalanceRow = z.infer<typeof AgentCreditBalanceSelectSchema>

/**
 * TypeScript type for agentCreditBalance insert
 */
export type AgentCreditBalanceInsert = z.infer<typeof AgentCreditBalanceInsertSchema>

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
// AgentTaskUsage Schemas
// =============================================================================

/**
 * Zod schema for selecting agentTaskUsage rows from database
 * Generated from Drizzle table definition: tables.agentTaskUsage
 */
export const AgentTaskUsageSelectSchema = createSelectSchema(tables.agentTaskUsage)

/**
 * Zod schema for inserting agentTaskUsage rows to database
 * Generated from Drizzle table definition: tables.agentTaskUsage
 */
export const AgentTaskUsageInsertSchema = createInsertSchema(tables.agentTaskUsage)

/**
 * TypeScript type for agentTaskUsage row (Select)
 */
export type AgentTaskUsageRow = z.infer<typeof AgentTaskUsageSelectSchema>

/**
 * TypeScript type for agentTaskUsage insert
 */
export type AgentTaskUsageInsert = z.infer<typeof AgentTaskUsageInsertSchema>

// =============================================================================
// AiMemorySessions Schemas
// =============================================================================

/**
 * Zod schema for selecting aiMemorySessions rows from database
 * Generated from Drizzle table definition: tables.aiMemorySessions
 */
export const AiMemorySessionsSelectSchema = createSelectSchema(tables.aiMemorySessions)

/**
 * Zod schema for inserting aiMemorySessions rows to database
 * Generated from Drizzle table definition: tables.aiMemorySessions
 */
export const AiMemorySessionsInsertSchema = createInsertSchema(tables.aiMemorySessions)

/**
 * TypeScript type for aiMemorySessions row (Select)
 */
export type AiMemorySessionsRow = z.infer<typeof AiMemorySessionsSelectSchema>

/**
 * TypeScript type for aiMemorySessions insert
 */
export type AiMemorySessionsInsert = z.infer<typeof AiMemorySessionsInsertSchema>

// =============================================================================
// AppLogs Schemas
// =============================================================================

/**
 * Zod schema for selecting appLogs rows from database
 * Generated from Drizzle table definition: tables.appLogs
 */
export const AppLogsSelectSchema = createSelectSchema(tables.appLogs)

/**
 * Zod schema for inserting appLogs rows to database
 * Generated from Drizzle table definition: tables.appLogs
 */
export const AppLogsInsertSchema = createInsertSchema(tables.appLogs)

/**
 * TypeScript type for appLogs row (Select)
 */
export type AppLogsRow = z.infer<typeof AppLogsSelectSchema>

/**
 * TypeScript type for appLogs insert
 */
export type AppLogsInsert = z.infer<typeof AppLogsInsertSchema>

// =============================================================================
// AuditLog Schemas
// =============================================================================

/**
 * Zod schema for selecting auditLog rows from database
 * Generated from Drizzle table definition: tables.auditLog
 */
export const AuditLogSelectSchema = createSelectSchema(tables.auditLog)

/**
 * Zod schema for inserting auditLog rows to database
 * Generated from Drizzle table definition: tables.auditLog
 */
export const AuditLogInsertSchema = createInsertSchema(tables.auditLog)

/**
 * TypeScript type for auditLog row (Select)
 */
export type AuditLogRow = z.infer<typeof AuditLogSelectSchema>

/**
 * TypeScript type for auditLog insert
 */
export type AuditLogInsert = z.infer<typeof AuditLogInsertSchema>

// =============================================================================
// BillingCatalog Schemas
// =============================================================================

/**
 * Zod schema for selecting billingCatalog rows from database
 * Generated from Drizzle table definition: tables.billingCatalog
 */
export const BillingCatalogSelectSchema = createSelectSchema(tables.billingCatalog)

/**
 * Zod schema for inserting billingCatalog rows to database
 * Generated from Drizzle table definition: tables.billingCatalog
 */
export const BillingCatalogInsertSchema = createInsertSchema(tables.billingCatalog)

/**
 * TypeScript type for billingCatalog row (Select)
 */
export type BillingCatalogRow = z.infer<typeof BillingCatalogSelectSchema>

/**
 * TypeScript type for billingCatalog insert
 */
export type BillingCatalogInsert = z.infer<typeof BillingCatalogInsertSchema>

// =============================================================================
// BoardColumns Schemas
// =============================================================================

/**
 * Zod schema for selecting boardColumns rows from database
 * Generated from Drizzle table definition: tables.boardColumns
 */
export const BoardColumnsSelectSchema = createSelectSchema(tables.boardColumns)

/**
 * Zod schema for inserting boardColumns rows to database
 * Generated from Drizzle table definition: tables.boardColumns
 */
export const BoardColumnsInsertSchema = createInsertSchema(tables.boardColumns)

/**
 * TypeScript type for boardColumns row (Select)
 */
export type BoardColumnsRow = z.infer<typeof BoardColumnsSelectSchema>

/**
 * TypeScript type for boardColumns insert
 */
export type BoardColumnsInsert = z.infer<typeof BoardColumnsInsertSchema>

// =============================================================================
// Boards Schemas
// =============================================================================

/**
 * Zod schema for selecting boards rows from database
 * Generated from Drizzle table definition: tables.boards
 */
export const BoardsSelectSchema = createSelectSchema(tables.boards)

/**
 * Zod schema for inserting boards rows to database
 * Generated from Drizzle table definition: tables.boards
 */
export const BoardsInsertSchema = createInsertSchema(tables.boards)

/**
 * TypeScript type for boards row (Select)
 */
export type BoardsRow = z.infer<typeof BoardsSelectSchema>

/**
 * TypeScript type for boards insert
 */
export type BoardsInsert = z.infer<typeof BoardsInsertSchema>

// =============================================================================
// CircuitBreakerState Schemas
// =============================================================================

/**
 * Zod schema for selecting circuitBreakerState rows from database
 * Generated from Drizzle table definition: tables.circuitBreakerState
 */
export const CircuitBreakerStateSelectSchema = createSelectSchema(tables.circuitBreakerState)

/**
 * Zod schema for inserting circuitBreakerState rows to database
 * Generated from Drizzle table definition: tables.circuitBreakerState
 */
export const CircuitBreakerStateInsertSchema = createInsertSchema(tables.circuitBreakerState)

/**
 * TypeScript type for circuitBreakerState row (Select)
 */
export type CircuitBreakerStateRow = z.infer<typeof CircuitBreakerStateSelectSchema>

/**
 * TypeScript type for circuitBreakerState insert
 */
export type CircuitBreakerStateInsert = z.infer<typeof CircuitBreakerStateInsertSchema>

// =============================================================================
// CodeProvenance Schemas
// =============================================================================

/**
 * Zod schema for selecting codeProvenance rows from database
 * Generated from Drizzle table definition: tables.codeProvenance
 */
export const CodeProvenanceSelectSchema = createSelectSchema(tables.codeProvenance)

/**
 * Zod schema for inserting codeProvenance rows to database
 * Generated from Drizzle table definition: tables.codeProvenance
 */
export const CodeProvenanceInsertSchema = createInsertSchema(tables.codeProvenance)

/**
 * TypeScript type for codeProvenance row (Select)
 */
export type CodeProvenanceRow = z.infer<typeof CodeProvenanceSelectSchema>

/**
 * TypeScript type for codeProvenance insert
 */
export type CodeProvenanceInsert = z.infer<typeof CodeProvenanceInsertSchema>

// =============================================================================
// CodeReviews Schemas
// =============================================================================

/**
 * Zod schema for selecting codeReviews rows from database
 * Generated from Drizzle table definition: tables.codeReviews
 */
export const CodeReviewsSelectSchema = createSelectSchema(tables.codeReviews)

/**
 * Zod schema for inserting codeReviews rows to database
 * Generated from Drizzle table definition: tables.codeReviews
 */
export const CodeReviewsInsertSchema = createInsertSchema(tables.codeReviews)

/**
 * TypeScript type for codeReviews row (Select)
 */
export type CodeReviewsRow = z.infer<typeof CodeReviewsSelectSchema>

/**
 * TypeScript type for codeReviews insert
 */
export type CodeReviewsInsert = z.infer<typeof CodeReviewsInsertSchema>

// =============================================================================
// CollabEdits Schemas
// =============================================================================

/**
 * Zod schema for selecting collabEdits rows from database
 * Generated from Drizzle table definition: tables.collabEdits
 */
export const CollabEditsSelectSchema = createSelectSchema(tables.collabEdits)

/**
 * Zod schema for inserting collabEdits rows to database
 * Generated from Drizzle table definition: tables.collabEdits
 */
export const CollabEditsInsertSchema = createInsertSchema(tables.collabEdits)

/**
 * TypeScript type for collabEdits row (Select)
 */
export type CollabEditsRow = z.infer<typeof CollabEditsSelectSchema>

/**
 * TypeScript type for collabEdits insert
 */
export type CollabEditsInsert = z.infer<typeof CollabEditsInsertSchema>

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
// CoordinationAgents Schemas
// =============================================================================

/**
 * Zod schema for selecting coordinationAgents rows from database
 * Generated from Drizzle table definition: tables.coordinationAgents
 */
export const CoordinationAgentsSelectSchema = createSelectSchema(tables.coordinationAgents)

/**
 * Zod schema for inserting coordinationAgents rows to database
 * Generated from Drizzle table definition: tables.coordinationAgents
 */
export const CoordinationAgentsInsertSchema = createInsertSchema(tables.coordinationAgents)

/**
 * TypeScript type for coordinationAgents row (Select)
 */
export type CoordinationAgentsRow = z.infer<typeof CoordinationAgentsSelectSchema>

/**
 * TypeScript type for coordinationAgents insert
 */
export type CoordinationAgentsInsert = z.infer<typeof CoordinationAgentsInsertSchema>

// =============================================================================
// CoordinationEvents Schemas
// =============================================================================

/**
 * Zod schema for selecting coordinationEvents rows from database
 * Generated from Drizzle table definition: tables.coordinationEvents
 */
export const CoordinationEventsSelectSchema = createSelectSchema(tables.coordinationEvents)

/**
 * Zod schema for inserting coordinationEvents rows to database
 * Generated from Drizzle table definition: tables.coordinationEvents
 */
export const CoordinationEventsInsertSchema = createInsertSchema(tables.coordinationEvents)

/**
 * TypeScript type for coordinationEvents row (Select)
 */
export type CoordinationEventsRow = z.infer<typeof CoordinationEventsSelectSchema>

/**
 * TypeScript type for coordinationEvents insert
 */
export type CoordinationEventsInsert = z.infer<typeof CoordinationEventsInsertSchema>

// =============================================================================
// CoordinationFileClaims Schemas
// =============================================================================

/**
 * Zod schema for selecting coordinationFileClaims rows from database
 * Generated from Drizzle table definition: tables.coordinationFileClaims
 */
export const CoordinationFileClaimsSelectSchema = createSelectSchema(tables.coordinationFileClaims)

/**
 * Zod schema for inserting coordinationFileClaims rows to database
 * Generated from Drizzle table definition: tables.coordinationFileClaims
 */
export const CoordinationFileClaimsInsertSchema = createInsertSchema(tables.coordinationFileClaims)

/**
 * TypeScript type for coordinationFileClaims row (Select)
 */
export type CoordinationFileClaimsRow = z.infer<typeof CoordinationFileClaimsSelectSchema>

/**
 * TypeScript type for coordinationFileClaims insert
 */
export type CoordinationFileClaimsInsert = z.infer<typeof CoordinationFileClaimsInsertSchema>

// =============================================================================
// CoordinationMail Schemas
// =============================================================================

/**
 * Zod schema for selecting coordinationMail rows from database
 * Generated from Drizzle table definition: tables.coordinationMail
 */
export const CoordinationMailSelectSchema = createSelectSchema(tables.coordinationMail)

/**
 * Zod schema for inserting coordinationMail rows to database
 * Generated from Drizzle table definition: tables.coordinationMail
 */
export const CoordinationMailInsertSchema = createInsertSchema(tables.coordinationMail)

/**
 * TypeScript type for coordinationMail row (Select)
 */
export type CoordinationMailRow = z.infer<typeof CoordinationMailSelectSchema>

/**
 * TypeScript type for coordinationMail insert
 */
export type CoordinationMailInsert = z.infer<typeof CoordinationMailInsertSchema>

// =============================================================================
// CoordinationQueueItems Schemas
// =============================================================================

/**
 * Zod schema for selecting coordinationQueueItems rows from database
 * Generated from Drizzle table definition: tables.coordinationQueueItems
 */
export const CoordinationQueueItemsSelectSchema = createSelectSchema(tables.coordinationQueueItems)

/**
 * Zod schema for inserting coordinationQueueItems rows to database
 * Generated from Drizzle table definition: tables.coordinationQueueItems
 */
export const CoordinationQueueItemsInsertSchema = createInsertSchema(tables.coordinationQueueItems)

/**
 * TypeScript type for coordinationQueueItems row (Select)
 */
export type CoordinationQueueItemsRow = z.infer<typeof CoordinationQueueItemsSelectSchema>

/**
 * TypeScript type for coordinationQueueItems insert
 */
export type CoordinationQueueItemsInsert = z.infer<typeof CoordinationQueueItemsInsertSchema>

// =============================================================================
// CoordinationSessions Schemas
// =============================================================================

/**
 * Zod schema for selecting coordinationSessions rows from database
 * Generated from Drizzle table definition: tables.coordinationSessions
 */
export const CoordinationSessionsSelectSchema = createSelectSchema(tables.coordinationSessions)

/**
 * Zod schema for inserting coordinationSessions rows to database
 * Generated from Drizzle table definition: tables.coordinationSessions
 */
export const CoordinationSessionsInsertSchema = createInsertSchema(tables.coordinationSessions)

/**
 * TypeScript type for coordinationSessions row (Select)
 */
export type CoordinationSessionsRow = z.infer<typeof CoordinationSessionsSelectSchema>

/**
 * TypeScript type for coordinationSessions insert
 */
export type CoordinationSessionsInsert = z.infer<typeof CoordinationSessionsInsertSchema>

// =============================================================================
// CoordinationWorkItems Schemas
// =============================================================================

/**
 * Zod schema for selecting coordinationWorkItems rows from database
 * Generated from Drizzle table definition: tables.coordinationWorkItems
 */
export const CoordinationWorkItemsSelectSchema = createSelectSchema(tables.coordinationWorkItems)

/**
 * Zod schema for inserting coordinationWorkItems rows to database
 * Generated from Drizzle table definition: tables.coordinationWorkItems
 */
export const CoordinationWorkItemsInsertSchema = createInsertSchema(tables.coordinationWorkItems)

/**
 * TypeScript type for coordinationWorkItems row (Select)
 */
export type CoordinationWorkItemsRow = z.infer<typeof CoordinationWorkItemsSelectSchema>

/**
 * TypeScript type for coordinationWorkItems insert
 */
export type CoordinationWorkItemsInsert = z.infer<typeof CoordinationWorkItemsInsertSchema>

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
// ErrorEvents Schemas
// =============================================================================

/**
 * Zod schema for selecting errorEvents rows from database
 * Generated from Drizzle table definition: tables.errorEvents
 */
export const ErrorEventsSelectSchema = createSelectSchema(tables.errorEvents)

/**
 * Zod schema for inserting errorEvents rows to database
 * Generated from Drizzle table definition: tables.errorEvents
 */
export const ErrorEventsInsertSchema = createInsertSchema(tables.errorEvents)

/**
 * TypeScript type for errorEvents row (Select)
 */
export type ErrorEventsRow = z.infer<typeof ErrorEventsSelectSchema>

/**
 * TypeScript type for errorEvents insert
 */
export type ErrorEventsInsert = z.infer<typeof ErrorEventsInsertSchema>

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
// GdprBreaches Schemas
// =============================================================================

/**
 * Zod schema for selecting gdprBreaches rows from database
 * Generated from Drizzle table definition: tables.gdprBreaches
 */
export const GdprBreachesSelectSchema = createSelectSchema(tables.gdprBreaches)

/**
 * Zod schema for inserting gdprBreaches rows to database
 * Generated from Drizzle table definition: tables.gdprBreaches
 */
export const GdprBreachesInsertSchema = createInsertSchema(tables.gdprBreaches)

/**
 * TypeScript type for gdprBreaches row (Select)
 */
export type GdprBreachesRow = z.infer<typeof GdprBreachesSelectSchema>

/**
 * TypeScript type for gdprBreaches insert
 */
export type GdprBreachesInsert = z.infer<typeof GdprBreachesInsertSchema>

// =============================================================================
// GdprConsents Schemas
// =============================================================================

/**
 * Zod schema for selecting gdprConsents rows from database
 * Generated from Drizzle table definition: tables.gdprConsents
 */
export const GdprConsentsSelectSchema = createSelectSchema(tables.gdprConsents)

/**
 * Zod schema for inserting gdprConsents rows to database
 * Generated from Drizzle table definition: tables.gdprConsents
 */
export const GdprConsentsInsertSchema = createInsertSchema(tables.gdprConsents)

/**
 * TypeScript type for gdprConsents row (Select)
 */
export type GdprConsentsRow = z.infer<typeof GdprConsentsSelectSchema>

/**
 * TypeScript type for gdprConsents insert
 */
export type GdprConsentsInsert = z.infer<typeof GdprConsentsInsertSchema>

// =============================================================================
// GdprDeletionRequests Schemas
// =============================================================================

/**
 * Zod schema for selecting gdprDeletionRequests rows from database
 * Generated from Drizzle table definition: tables.gdprDeletionRequests
 */
export const GdprDeletionRequestsSelectSchema = createSelectSchema(tables.gdprDeletionRequests)

/**
 * Zod schema for inserting gdprDeletionRequests rows to database
 * Generated from Drizzle table definition: tables.gdprDeletionRequests
 */
export const GdprDeletionRequestsInsertSchema = createInsertSchema(tables.gdprDeletionRequests)

/**
 * TypeScript type for gdprDeletionRequests row (Select)
 */
export type GdprDeletionRequestsRow = z.infer<typeof GdprDeletionRequestsSelectSchema>

/**
 * TypeScript type for gdprDeletionRequests insert
 */
export type GdprDeletionRequestsInsert = z.infer<typeof GdprDeletionRequestsInsertSchema>

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
// Jobs Schemas
// =============================================================================

/**
 * Zod schema for selecting jobs rows from database
 * Generated from Drizzle table definition: tables.jobs
 */
export const JobsSelectSchema = createSelectSchema(tables.jobs)

/**
 * Zod schema for inserting jobs rows to database
 * Generated from Drizzle table definition: tables.jobs
 */
export const JobsInsertSchema = createInsertSchema(tables.jobs)

/**
 * TypeScript type for jobs row (Select)
 */
export type JobsRow = z.infer<typeof JobsSelectSchema>

/**
 * TypeScript type for jobs insert
 */
export type JobsInsert = z.infer<typeof JobsInsertSchema>

// =============================================================================
// Licenses Schemas
// =============================================================================

/**
 * Zod schema for selecting licenses rows from database
 * Generated from Drizzle table definition: tables.licenses
 */
export const LicensesSelectSchema = createSelectSchema(tables.licenses)

/**
 * Zod schema for inserting licenses rows to database
 * Generated from Drizzle table definition: tables.licenses
 */
export const LicensesInsertSchema = createInsertSchema(tables.licenses)

/**
 * TypeScript type for licenses row (Select)
 */
export type LicensesRow = z.infer<typeof LicensesSelectSchema>

/**
 * TypeScript type for licenses insert
 */
export type LicensesInsert = z.infer<typeof LicensesInsertSchema>

// =============================================================================
// MagicLinks Schemas
// =============================================================================

/**
 * Zod schema for selecting magicLinks rows from database
 * Generated from Drizzle table definition: tables.magicLinks
 */
export const MagicLinksSelectSchema = createSelectSchema(tables.magicLinks)

/**
 * Zod schema for inserting magicLinks rows to database
 * Generated from Drizzle table definition: tables.magicLinks
 */
export const MagicLinksInsertSchema = createInsertSchema(tables.magicLinks)

/**
 * TypeScript type for magicLinks row (Select)
 */
export type MagicLinksRow = z.infer<typeof MagicLinksSelectSchema>

/**
 * TypeScript type for magicLinks insert
 */
export type MagicLinksInsert = z.infer<typeof MagicLinksInsertSchema>

// =============================================================================
// MarketplaceServers Schemas
// =============================================================================

/**
 * Zod schema for selecting marketplaceServers rows from database
 * Generated from Drizzle table definition: tables.marketplaceServers
 */
export const MarketplaceServersSelectSchema = createSelectSchema(tables.marketplaceServers)

/**
 * Zod schema for inserting marketplaceServers rows to database
 * Generated from Drizzle table definition: tables.marketplaceServers
 */
export const MarketplaceServersInsertSchema = createInsertSchema(tables.marketplaceServers)

/**
 * TypeScript type for marketplaceServers row (Select)
 */
export type MarketplaceServersRow = z.infer<typeof MarketplaceServersSelectSchema>

/**
 * TypeScript type for marketplaceServers insert
 */
export type MarketplaceServersInsert = z.infer<typeof MarketplaceServersInsertSchema>

// =============================================================================
// MarketplaceTransactions Schemas
// =============================================================================

/**
 * Zod schema for selecting marketplaceTransactions rows from database
 * Generated from Drizzle table definition: tables.marketplaceTransactions
 */
export const MarketplaceTransactionsSelectSchema = createSelectSchema(tables.marketplaceTransactions)

/**
 * Zod schema for inserting marketplaceTransactions rows to database
 * Generated from Drizzle table definition: tables.marketplaceTransactions
 */
export const MarketplaceTransactionsInsertSchema = createInsertSchema(tables.marketplaceTransactions)

/**
 * TypeScript type for marketplaceTransactions row (Select)
 */
export type MarketplaceTransactionsRow = z.infer<typeof MarketplaceTransactionsSelectSchema>

/**
 * TypeScript type for marketplaceTransactions insert
 */
export type MarketplaceTransactionsInsert = z.infer<typeof MarketplaceTransactionsInsertSchema>

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
// OauthAccounts Schemas
// =============================================================================

/**
 * Zod schema for selecting oauthAccounts rows from database
 * Generated from Drizzle table definition: tables.oauthAccounts
 */
export const OauthAccountsSelectSchema = createSelectSchema(tables.oauthAccounts)

/**
 * Zod schema for inserting oauthAccounts rows to database
 * Generated from Drizzle table definition: tables.oauthAccounts
 */
export const OauthAccountsInsertSchema = createInsertSchema(tables.oauthAccounts)

/**
 * TypeScript type for oauthAccounts row (Select)
 */
export type OauthAccountsRow = z.infer<typeof OauthAccountsSelectSchema>

/**
 * TypeScript type for oauthAccounts insert
 */
export type OauthAccountsInsert = z.infer<typeof OauthAccountsInsertSchema>

// =============================================================================
// Orders Schemas
// =============================================================================

/**
 * Zod schema for selecting orders rows from database
 * Generated from Drizzle table definition: tables.orders
 */
export const OrdersSelectSchema = createSelectSchema(tables.orders)

/**
 * Zod schema for inserting orders rows to database
 * Generated from Drizzle table definition: tables.orders
 */
export const OrdersInsertSchema = createInsertSchema(tables.orders)

/**
 * TypeScript type for orders row (Select)
 */
export type OrdersRow = z.infer<typeof OrdersSelectSchema>

/**
 * TypeScript type for orders insert
 */
export type OrdersInsert = z.infer<typeof OrdersInsertSchema>

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
// Passkeys Schemas
// =============================================================================

/**
 * Zod schema for selecting passkeys rows from database
 * Generated from Drizzle table definition: tables.passkeys
 */
export const PasskeysSelectSchema = createSelectSchema(tables.passkeys)

/**
 * Zod schema for inserting passkeys rows to database
 * Generated from Drizzle table definition: tables.passkeys
 */
export const PasskeysInsertSchema = createInsertSchema(tables.passkeys)

/**
 * TypeScript type for passkeys row (Select)
 */
export type PasskeysRow = z.infer<typeof PasskeysSelectSchema>

/**
 * TypeScript type for passkeys insert
 */
export type PasskeysInsert = z.infer<typeof PasskeysInsertSchema>

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
// ProcessedWebhookEvents Schemas
// =============================================================================

/**
 * Zod schema for selecting processedWebhookEvents rows from database
 * Generated from Drizzle table definition: tables.processedWebhookEvents
 */
export const ProcessedWebhookEventsSelectSchema = createSelectSchema(tables.processedWebhookEvents)

/**
 * Zod schema for inserting processedWebhookEvents rows to database
 * Generated from Drizzle table definition: tables.processedWebhookEvents
 */
export const ProcessedWebhookEventsInsertSchema = createInsertSchema(tables.processedWebhookEvents)

/**
 * TypeScript type for processedWebhookEvents row (Select)
 */
export type ProcessedWebhookEventsRow = z.infer<typeof ProcessedWebhookEventsSelectSchema>

/**
 * TypeScript type for processedWebhookEvents insert
 */
export type ProcessedWebhookEventsInsert = z.infer<typeof ProcessedWebhookEventsInsertSchema>

// =============================================================================
// Products Schemas
// =============================================================================

/**
 * Zod schema for selecting products rows from database
 * Generated from Drizzle table definition: tables.products
 */
export const ProductsSelectSchema = createSelectSchema(tables.products)

/**
 * Zod schema for inserting products rows to database
 * Generated from Drizzle table definition: tables.products
 */
export const ProductsInsertSchema = createInsertSchema(tables.products)

/**
 * TypeScript type for products row (Select)
 */
export type ProductsRow = z.infer<typeof ProductsSelectSchema>

/**
 * TypeScript type for products insert
 */
export type ProductsInsert = z.infer<typeof ProductsInsertSchema>

// =============================================================================
// RagChunks Schemas
// =============================================================================

/**
 * Zod schema for selecting ragChunks rows from database
 * Generated from Drizzle table definition: tables.ragChunks
 */
export const RagChunksSelectSchema = createSelectSchema(tables.ragChunks)

/**
 * Zod schema for inserting ragChunks rows to database
 * Generated from Drizzle table definition: tables.ragChunks
 */
export const RagChunksInsertSchema = createInsertSchema(tables.ragChunks)

/**
 * TypeScript type for ragChunks row (Select)
 */
export type RagChunksRow = z.infer<typeof RagChunksSelectSchema>

/**
 * TypeScript type for ragChunks insert
 */
export type RagChunksInsert = z.infer<typeof RagChunksInsertSchema>

// =============================================================================
// RagDocuments Schemas
// =============================================================================

/**
 * Zod schema for selecting ragDocuments rows from database
 * Generated from Drizzle table definition: tables.ragDocuments
 */
export const RagDocumentsSelectSchema = createSelectSchema(tables.ragDocuments)

/**
 * Zod schema for inserting ragDocuments rows to database
 * Generated from Drizzle table definition: tables.ragDocuments
 */
export const RagDocumentsInsertSchema = createInsertSchema(tables.ragDocuments)

/**
 * TypeScript type for ragDocuments row (Select)
 */
export type RagDocumentsRow = z.infer<typeof RagDocumentsSelectSchema>

/**
 * TypeScript type for ragDocuments insert
 */
export type RagDocumentsInsert = z.infer<typeof RagDocumentsInsertSchema>

// =============================================================================
// RagWorkspaces Schemas
// =============================================================================

/**
 * Zod schema for selecting ragWorkspaces rows from database
 * Generated from Drizzle table definition: tables.ragWorkspaces
 */
export const RagWorkspacesSelectSchema = createSelectSchema(tables.ragWorkspaces)

/**
 * Zod schema for inserting ragWorkspaces rows to database
 * Generated from Drizzle table definition: tables.ragWorkspaces
 */
export const RagWorkspacesInsertSchema = createInsertSchema(tables.ragWorkspaces)

/**
 * TypeScript type for ragWorkspaces row (Select)
 */
export type RagWorkspacesRow = z.infer<typeof RagWorkspacesSelectSchema>

/**
 * TypeScript type for ragWorkspaces insert
 */
export type RagWorkspacesInsert = z.infer<typeof RagWorkspacesInsertSchema>

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
// RegisteredAgents Schemas
// =============================================================================

/**
 * Zod schema for selecting registeredAgents rows from database
 * Generated from Drizzle table definition: tables.registeredAgents
 */
export const RegisteredAgentsSelectSchema = createSelectSchema(tables.registeredAgents)

/**
 * Zod schema for inserting registeredAgents rows to database
 * Generated from Drizzle table definition: tables.registeredAgents
 */
export const RegisteredAgentsInsertSchema = createInsertSchema(tables.registeredAgents)

/**
 * TypeScript type for registeredAgents row (Select)
 */
export type RegisteredAgentsRow = z.infer<typeof RegisteredAgentsSelectSchema>

/**
 * TypeScript type for registeredAgents insert
 */
export type RegisteredAgentsInsert = z.infer<typeof RegisteredAgentsInsertSchema>

// =============================================================================
// RevealcoinPayments Schemas
// =============================================================================

/**
 * Zod schema for selecting revealcoinPayments rows from database
 * Generated from Drizzle table definition: tables.revealcoinPayments
 */
export const RevealcoinPaymentsSelectSchema = createSelectSchema(tables.revealcoinPayments)

/**
 * Zod schema for inserting revealcoinPayments rows to database
 * Generated from Drizzle table definition: tables.revealcoinPayments
 */
export const RevealcoinPaymentsInsertSchema = createInsertSchema(tables.revealcoinPayments)

/**
 * TypeScript type for revealcoinPayments row (Select)
 */
export type RevealcoinPaymentsRow = z.infer<typeof RevealcoinPaymentsSelectSchema>

/**
 * TypeScript type for revealcoinPayments insert
 */
export type RevealcoinPaymentsInsert = z.infer<typeof RevealcoinPaymentsInsertSchema>

// =============================================================================
// RevealcoinPriceSnapshots Schemas
// =============================================================================

/**
 * Zod schema for selecting revealcoinPriceSnapshots rows from database
 * Generated from Drizzle table definition: tables.revealcoinPriceSnapshots
 */
export const RevealcoinPriceSnapshotsSelectSchema = createSelectSchema(tables.revealcoinPriceSnapshots)

/**
 * Zod schema for inserting revealcoinPriceSnapshots rows to database
 * Generated from Drizzle table definition: tables.revealcoinPriceSnapshots
 */
export const RevealcoinPriceSnapshotsInsertSchema = createInsertSchema(tables.revealcoinPriceSnapshots)

/**
 * TypeScript type for revealcoinPriceSnapshots row (Select)
 */
export type RevealcoinPriceSnapshotsRow = z.infer<typeof RevealcoinPriceSnapshotsSelectSchema>

/**
 * TypeScript type for revealcoinPriceSnapshots insert
 */
export type RevealcoinPriceSnapshotsInsert = z.infer<typeof RevealcoinPriceSnapshotsInsertSchema>

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
// TenantProviderConfigs Schemas
// =============================================================================

/**
 * Zod schema for selecting tenantProviderConfigs rows from database
 * Generated from Drizzle table definition: tables.tenantProviderConfigs
 */
export const TenantProviderConfigsSelectSchema = createSelectSchema(tables.tenantProviderConfigs)

/**
 * Zod schema for inserting tenantProviderConfigs rows to database
 * Generated from Drizzle table definition: tables.tenantProviderConfigs
 */
export const TenantProviderConfigsInsertSchema = createInsertSchema(tables.tenantProviderConfigs)

/**
 * TypeScript type for tenantProviderConfigs row (Select)
 */
export type TenantProviderConfigsRow = z.infer<typeof TenantProviderConfigsSelectSchema>

/**
 * TypeScript type for tenantProviderConfigs insert
 */
export type TenantProviderConfigsInsert = z.infer<typeof TenantProviderConfigsInsertSchema>

// =============================================================================
// Tenants Schemas
// =============================================================================

/**
 * Zod schema for selecting tenants rows from database
 * Generated from Drizzle table definition: tables.tenants
 */
export const TenantsSelectSchema = createSelectSchema(tables.tenants)

/**
 * Zod schema for inserting tenants rows to database
 * Generated from Drizzle table definition: tables.tenants
 */
export const TenantsInsertSchema = createInsertSchema(tables.tenants)

/**
 * TypeScript type for tenants row (Select)
 */
export type TenantsRow = z.infer<typeof TenantsSelectSchema>

/**
 * TypeScript type for tenants insert
 */
export type TenantsInsert = z.infer<typeof TenantsInsertSchema>

// =============================================================================
// TicketComments Schemas
// =============================================================================

/**
 * Zod schema for selecting ticketComments rows from database
 * Generated from Drizzle table definition: tables.ticketComments
 */
export const TicketCommentsSelectSchema = createSelectSchema(tables.ticketComments)

/**
 * Zod schema for inserting ticketComments rows to database
 * Generated from Drizzle table definition: tables.ticketComments
 */
export const TicketCommentsInsertSchema = createInsertSchema(tables.ticketComments)

/**
 * TypeScript type for ticketComments row (Select)
 */
export type TicketCommentsRow = z.infer<typeof TicketCommentsSelectSchema>

/**
 * TypeScript type for ticketComments insert
 */
export type TicketCommentsInsert = z.infer<typeof TicketCommentsInsertSchema>

// =============================================================================
// TicketLabelAssignments Schemas
// =============================================================================

/**
 * Zod schema for selecting ticketLabelAssignments rows from database
 * Generated from Drizzle table definition: tables.ticketLabelAssignments
 */
export const TicketLabelAssignmentsSelectSchema = createSelectSchema(tables.ticketLabelAssignments)

/**
 * Zod schema for inserting ticketLabelAssignments rows to database
 * Generated from Drizzle table definition: tables.ticketLabelAssignments
 */
export const TicketLabelAssignmentsInsertSchema = createInsertSchema(tables.ticketLabelAssignments)

/**
 * TypeScript type for ticketLabelAssignments row (Select)
 */
export type TicketLabelAssignmentsRow = z.infer<typeof TicketLabelAssignmentsSelectSchema>

/**
 * TypeScript type for ticketLabelAssignments insert
 */
export type TicketLabelAssignmentsInsert = z.infer<typeof TicketLabelAssignmentsInsertSchema>

// =============================================================================
// TicketLabels Schemas
// =============================================================================

/**
 * Zod schema for selecting ticketLabels rows from database
 * Generated from Drizzle table definition: tables.ticketLabels
 */
export const TicketLabelsSelectSchema = createSelectSchema(tables.ticketLabels)

/**
 * Zod schema for inserting ticketLabels rows to database
 * Generated from Drizzle table definition: tables.ticketLabels
 */
export const TicketLabelsInsertSchema = createInsertSchema(tables.ticketLabels)

/**
 * TypeScript type for ticketLabels row (Select)
 */
export type TicketLabelsRow = z.infer<typeof TicketLabelsSelectSchema>

/**
 * TypeScript type for ticketLabels insert
 */
export type TicketLabelsInsert = z.infer<typeof TicketLabelsInsertSchema>

// =============================================================================
// Tickets Schemas
// =============================================================================

/**
 * Zod schema for selecting tickets rows from database
 * Generated from Drizzle table definition: tables.tickets
 */
export const TicketsSelectSchema = createSelectSchema(tables.tickets)

/**
 * Zod schema for inserting tickets rows to database
 * Generated from Drizzle table definition: tables.tickets
 */
export const TicketsInsertSchema = createInsertSchema(tables.tickets)

/**
 * TypeScript type for tickets row (Select)
 */
export type TicketsRow = z.infer<typeof TicketsSelectSchema>

/**
 * TypeScript type for tickets insert
 */
export type TicketsInsert = z.infer<typeof TicketsInsertSchema>

// =============================================================================
// UsageMeters Schemas
// =============================================================================

/**
 * Zod schema for selecting usageMeters rows from database
 * Generated from Drizzle table definition: tables.usageMeters
 */
export const UsageMetersSelectSchema = createSelectSchema(tables.usageMeters)

/**
 * Zod schema for inserting usageMeters rows to database
 * Generated from Drizzle table definition: tables.usageMeters
 */
export const UsageMetersInsertSchema = createInsertSchema(tables.usageMeters)

/**
 * TypeScript type for usageMeters row (Select)
 */
export type UsageMetersRow = z.infer<typeof UsageMetersSelectSchema>

/**
 * TypeScript type for usageMeters insert
 */
export type UsageMetersInsert = z.infer<typeof UsageMetersInsertSchema>

// =============================================================================
// UserApiKeys Schemas
// =============================================================================

/**
 * Zod schema for selecting userApiKeys rows from database
 * Generated from Drizzle table definition: tables.userApiKeys
 */
export const UserApiKeysSelectSchema = createSelectSchema(tables.userApiKeys)

/**
 * Zod schema for inserting userApiKeys rows to database
 * Generated from Drizzle table definition: tables.userApiKeys
 */
export const UserApiKeysInsertSchema = createInsertSchema(tables.userApiKeys)

/**
 * TypeScript type for userApiKeys row (Select)
 */
export type UserApiKeysRow = z.infer<typeof UserApiKeysSelectSchema>

/**
 * TypeScript type for userApiKeys insert
 */
export type UserApiKeysInsert = z.infer<typeof UserApiKeysInsertSchema>

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

// =============================================================================
// Waitlist Schemas
// =============================================================================

/**
 * Zod schema for selecting waitlist rows from database
 * Generated from Drizzle table definition: tables.waitlist
 */
export const WaitlistSelectSchema = createSelectSchema(tables.waitlist)

/**
 * Zod schema for inserting waitlist rows to database
 * Generated from Drizzle table definition: tables.waitlist
 */
export const WaitlistInsertSchema = createInsertSchema(tables.waitlist)

/**
 * TypeScript type for waitlist row (Select)
 */
export type WaitlistRow = z.infer<typeof WaitlistSelectSchema>

/**
 * TypeScript type for waitlist insert
 */
export type WaitlistInsert = z.infer<typeof WaitlistInsertSchema>

// =============================================================================
// YjsDocuments Schemas
// =============================================================================

/**
 * Zod schema for selecting yjsDocuments rows from database
 * Generated from Drizzle table definition: tables.yjsDocuments
 */
export const YjsDocumentsSelectSchema = createSelectSchema(tables.yjsDocuments)

/**
 * Zod schema for inserting yjsDocuments rows to database
 * Generated from Drizzle table definition: tables.yjsDocuments
 */
export const YjsDocumentsInsertSchema = createInsertSchema(tables.yjsDocuments)

/**
 * TypeScript type for yjsDocuments row (Select)
 */
export type YjsDocumentsRow = z.infer<typeof YjsDocumentsSelectSchema>

/**
 * TypeScript type for yjsDocuments insert
 */
export type YjsDocumentsInsert = z.infer<typeof YjsDocumentsInsertSchema>
