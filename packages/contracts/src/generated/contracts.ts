/**
 * Auto-generated Contract wrappers
 *
 * DO NOT EDIT - Regenerate with: pnpm generate:all
 * Generated: 2026-03-28T02:03:55.304Z
 *
 * This file provides Contract wrappers for all database tables.
 * Contracts combine TypeScript types, Zod schemas, and runtime validation
 * into a single unified interface.
 *
 * These base contracts can be extended in entity contracts to add
 * business logic, computed fields, and custom validation rules.
 */

import { createContract } from '../foundation/contract.js'
import * as Schemas from './zod-schemas.js'

// =============================================================================
// AccountEntitlements Contracts
// =============================================================================

/**
 * Contract for accountEntitlements row (Select)
 * Database table: account_entitlements
 */
export const AccountEntitlementsRowContract = createContract({
  name: 'AccountEntitlementsRow',
  version: '1',
  description: 'Database row contract for account_entitlements table',
  schema: Schemas.AccountEntitlementsSelectSchema,
})

/**
 * Contract for accountEntitlements insert
 * Database table: account_entitlements
 */
export const AccountEntitlementsInsertContract = createContract({
  name: 'AccountEntitlementsInsert',
  version: '1',
  description: 'Database insert contract for account_entitlements table',
  schema: Schemas.AccountEntitlementsInsertSchema,
})

// =============================================================================
// AccountMemberships Contracts
// =============================================================================

/**
 * Contract for accountMemberships row (Select)
 * Database table: account_memberships
 */
export const AccountMembershipsRowContract = createContract({
  name: 'AccountMembershipsRow',
  version: '1',
  description: 'Database row contract for account_memberships table',
  schema: Schemas.AccountMembershipsSelectSchema,
})

/**
 * Contract for accountMemberships insert
 * Database table: account_memberships
 */
export const AccountMembershipsInsertContract = createContract({
  name: 'AccountMembershipsInsert',
  version: '1',
  description: 'Database insert contract for account_memberships table',
  schema: Schemas.AccountMembershipsInsertSchema,
})

// =============================================================================
// Accounts Contracts
// =============================================================================

/**
 * Contract for accounts row (Select)
 * Database table: accounts
 */
export const AccountsRowContract = createContract({
  name: 'AccountsRow',
  version: '1',
  description: 'Database row contract for accounts table',
  schema: Schemas.AccountsSelectSchema,
})

/**
 * Contract for accounts insert
 * Database table: accounts
 */
export const AccountsInsertContract = createContract({
  name: 'AccountsInsert',
  version: '1',
  description: 'Database insert contract for accounts table',
  schema: Schemas.AccountsInsertSchema,
})

// =============================================================================
// AccountSubscriptions Contracts
// =============================================================================

/**
 * Contract for accountSubscriptions row (Select)
 * Database table: account_subscriptions
 */
export const AccountSubscriptionsRowContract = createContract({
  name: 'AccountSubscriptionsRow',
  version: '1',
  description: 'Database row contract for account_subscriptions table',
  schema: Schemas.AccountSubscriptionsSelectSchema,
})

/**
 * Contract for accountSubscriptions insert
 * Database table: account_subscriptions
 */
export const AccountSubscriptionsInsertContract = createContract({
  name: 'AccountSubscriptionsInsert',
  version: '1',
  description: 'Database insert contract for account_subscriptions table',
  schema: Schemas.AccountSubscriptionsInsertSchema,
})

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
// AgentTaskUsage Contracts
// =============================================================================

/**
 * Contract for agentTaskUsage row (Select)
 * Database table: agent_task_usage
 */
export const AgentTaskUsageRowContract = createContract({
  name: 'AgentTaskUsageRow',
  version: '1',
  description: 'Database row contract for agent_task_usage table',
  schema: Schemas.AgentTaskUsageSelectSchema,
})

/**
 * Contract for agentTaskUsage insert
 * Database table: agent_task_usage
 */
export const AgentTaskUsageInsertContract = createContract({
  name: 'AgentTaskUsageInsert',
  version: '1',
  description: 'Database insert contract for agent_task_usage table',
  schema: Schemas.AgentTaskUsageInsertSchema,
})

// =============================================================================
// AiMemorySessions Contracts
// =============================================================================

/**
 * Contract for aiMemorySessions row (Select)
 * Database table: ai_memory_sessions
 */
export const AiMemorySessionsRowContract = createContract({
  name: 'AiMemorySessionsRow',
  version: '1',
  description: 'Database row contract for ai_memory_sessions table',
  schema: Schemas.AiMemorySessionsSelectSchema,
})

/**
 * Contract for aiMemorySessions insert
 * Database table: ai_memory_sessions
 */
export const AiMemorySessionsInsertContract = createContract({
  name: 'AiMemorySessionsInsert',
  version: '1',
  description: 'Database insert contract for ai_memory_sessions table',
  schema: Schemas.AiMemorySessionsInsertSchema,
})

// =============================================================================
// AppLogs Contracts
// =============================================================================

/**
 * Contract for appLogs row (Select)
 * Database table: app_logs
 */
export const AppLogsRowContract = createContract({
  name: 'AppLogsRow',
  version: '1',
  description: 'Database row contract for app_logs table',
  schema: Schemas.AppLogsSelectSchema,
})

/**
 * Contract for appLogs insert
 * Database table: app_logs
 */
export const AppLogsInsertContract = createContract({
  name: 'AppLogsInsert',
  version: '1',
  description: 'Database insert contract for app_logs table',
  schema: Schemas.AppLogsInsertSchema,
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
// BillingCatalog Contracts
// =============================================================================

/**
 * Contract for billingCatalog row (Select)
 * Database table: billing_catalog
 */
export const BillingCatalogRowContract = createContract({
  name: 'BillingCatalogRow',
  version: '1',
  description: 'Database row contract for billing_catalog table',
  schema: Schemas.BillingCatalogSelectSchema,
})

/**
 * Contract for billingCatalog insert
 * Database table: billing_catalog
 */
export const BillingCatalogInsertContract = createContract({
  name: 'BillingCatalogInsert',
  version: '1',
  description: 'Database insert contract for billing_catalog table',
  schema: Schemas.BillingCatalogInsertSchema,
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
// CircuitBreakerState Contracts
// =============================================================================

/**
 * Contract for circuitBreakerState row (Select)
 * Database table: circuit_breaker_state
 */
export const CircuitBreakerStateRowContract = createContract({
  name: 'CircuitBreakerStateRow',
  version: '1',
  description: 'Database row contract for circuit_breaker_state table',
  schema: Schemas.CircuitBreakerStateSelectSchema,
})

/**
 * Contract for circuitBreakerState insert
 * Database table: circuit_breaker_state
 */
export const CircuitBreakerStateInsertContract = createContract({
  name: 'CircuitBreakerStateInsert',
  version: '1',
  description: 'Database insert contract for circuit_breaker_state table',
  schema: Schemas.CircuitBreakerStateInsertSchema,
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
// CoordinationAgents Contracts
// =============================================================================

/**
 * Contract for coordinationAgents row (Select)
 * Database table: coordination_agents
 */
export const CoordinationAgentsRowContract = createContract({
  name: 'CoordinationAgentsRow',
  version: '1',
  description: 'Database row contract for coordination_agents table',
  schema: Schemas.CoordinationAgentsSelectSchema,
})

/**
 * Contract for coordinationAgents insert
 * Database table: coordination_agents
 */
export const CoordinationAgentsInsertContract = createContract({
  name: 'CoordinationAgentsInsert',
  version: '1',
  description: 'Database insert contract for coordination_agents table',
  schema: Schemas.CoordinationAgentsInsertSchema,
})

// =============================================================================
// CoordinationEvents Contracts
// =============================================================================

/**
 * Contract for coordinationEvents row (Select)
 * Database table: coordination_events
 */
export const CoordinationEventsRowContract = createContract({
  name: 'CoordinationEventsRow',
  version: '1',
  description: 'Database row contract for coordination_events table',
  schema: Schemas.CoordinationEventsSelectSchema,
})

/**
 * Contract for coordinationEvents insert
 * Database table: coordination_events
 */
export const CoordinationEventsInsertContract = createContract({
  name: 'CoordinationEventsInsert',
  version: '1',
  description: 'Database insert contract for coordination_events table',
  schema: Schemas.CoordinationEventsInsertSchema,
})

// =============================================================================
// CoordinationFileClaims Contracts
// =============================================================================

/**
 * Contract for coordinationFileClaims row (Select)
 * Database table: coordination_file_claims
 */
export const CoordinationFileClaimsRowContract = createContract({
  name: 'CoordinationFileClaimsRow',
  version: '1',
  description: 'Database row contract for coordination_file_claims table',
  schema: Schemas.CoordinationFileClaimsSelectSchema,
})

/**
 * Contract for coordinationFileClaims insert
 * Database table: coordination_file_claims
 */
export const CoordinationFileClaimsInsertContract = createContract({
  name: 'CoordinationFileClaimsInsert',
  version: '1',
  description: 'Database insert contract for coordination_file_claims table',
  schema: Schemas.CoordinationFileClaimsInsertSchema,
})

// =============================================================================
// CoordinationMail Contracts
// =============================================================================

/**
 * Contract for coordinationMail row (Select)
 * Database table: coordination_mail
 */
export const CoordinationMailRowContract = createContract({
  name: 'CoordinationMailRow',
  version: '1',
  description: 'Database row contract for coordination_mail table',
  schema: Schemas.CoordinationMailSelectSchema,
})

/**
 * Contract for coordinationMail insert
 * Database table: coordination_mail
 */
export const CoordinationMailInsertContract = createContract({
  name: 'CoordinationMailInsert',
  version: '1',
  description: 'Database insert contract for coordination_mail table',
  schema: Schemas.CoordinationMailInsertSchema,
})

// =============================================================================
// CoordinationQueueItems Contracts
// =============================================================================

/**
 * Contract for coordinationQueueItems row (Select)
 * Database table: coordination_queue_items
 */
export const CoordinationQueueItemsRowContract = createContract({
  name: 'CoordinationQueueItemsRow',
  version: '1',
  description: 'Database row contract for coordination_queue_items table',
  schema: Schemas.CoordinationQueueItemsSelectSchema,
})

/**
 * Contract for coordinationQueueItems insert
 * Database table: coordination_queue_items
 */
export const CoordinationQueueItemsInsertContract = createContract({
  name: 'CoordinationQueueItemsInsert',
  version: '1',
  description: 'Database insert contract for coordination_queue_items table',
  schema: Schemas.CoordinationQueueItemsInsertSchema,
})

// =============================================================================
// CoordinationSessions Contracts
// =============================================================================

/**
 * Contract for coordinationSessions row (Select)
 * Database table: coordination_sessions
 */
export const CoordinationSessionsRowContract = createContract({
  name: 'CoordinationSessionsRow',
  version: '1',
  description: 'Database row contract for coordination_sessions table',
  schema: Schemas.CoordinationSessionsSelectSchema,
})

/**
 * Contract for coordinationSessions insert
 * Database table: coordination_sessions
 */
export const CoordinationSessionsInsertContract = createContract({
  name: 'CoordinationSessionsInsert',
  version: '1',
  description: 'Database insert contract for coordination_sessions table',
  schema: Schemas.CoordinationSessionsInsertSchema,
})

// =============================================================================
// CoordinationWorkItems Contracts
// =============================================================================

/**
 * Contract for coordinationWorkItems row (Select)
 * Database table: coordination_work_items
 */
export const CoordinationWorkItemsRowContract = createContract({
  name: 'CoordinationWorkItemsRow',
  version: '1',
  description: 'Database row contract for coordination_work_items table',
  schema: Schemas.CoordinationWorkItemsSelectSchema,
})

/**
 * Contract for coordinationWorkItems insert
 * Database table: coordination_work_items
 */
export const CoordinationWorkItemsInsertContract = createContract({
  name: 'CoordinationWorkItemsInsert',
  version: '1',
  description: 'Database insert contract for coordination_work_items table',
  schema: Schemas.CoordinationWorkItemsInsertSchema,
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
// ErrorEvents Contracts
// =============================================================================

/**
 * Contract for errorEvents row (Select)
 * Database table: error_events
 */
export const ErrorEventsRowContract = createContract({
  name: 'ErrorEventsRow',
  version: '1',
  description: 'Database row contract for error_events table',
  schema: Schemas.ErrorEventsSelectSchema,
})

/**
 * Contract for errorEvents insert
 * Database table: error_events
 */
export const ErrorEventsInsertContract = createContract({
  name: 'ErrorEventsInsert',
  version: '1',
  description: 'Database insert contract for error_events table',
  schema: Schemas.ErrorEventsInsertSchema,
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
// GdprBreaches Contracts
// =============================================================================

/**
 * Contract for gdprBreaches row (Select)
 * Database table: gdpr_breaches
 */
export const GdprBreachesRowContract = createContract({
  name: 'GdprBreachesRow',
  version: '1',
  description: 'Database row contract for gdpr_breaches table',
  schema: Schemas.GdprBreachesSelectSchema,
})

/**
 * Contract for gdprBreaches insert
 * Database table: gdpr_breaches
 */
export const GdprBreachesInsertContract = createContract({
  name: 'GdprBreachesInsert',
  version: '1',
  description: 'Database insert contract for gdpr_breaches table',
  schema: Schemas.GdprBreachesInsertSchema,
})

// =============================================================================
// GdprConsents Contracts
// =============================================================================

/**
 * Contract for gdprConsents row (Select)
 * Database table: gdpr_consents
 */
export const GdprConsentsRowContract = createContract({
  name: 'GdprConsentsRow',
  version: '1',
  description: 'Database row contract for gdpr_consents table',
  schema: Schemas.GdprConsentsSelectSchema,
})

/**
 * Contract for gdprConsents insert
 * Database table: gdpr_consents
 */
export const GdprConsentsInsertContract = createContract({
  name: 'GdprConsentsInsert',
  version: '1',
  description: 'Database insert contract for gdpr_consents table',
  schema: Schemas.GdprConsentsInsertSchema,
})

// =============================================================================
// GdprDeletionRequests Contracts
// =============================================================================

/**
 * Contract for gdprDeletionRequests row (Select)
 * Database table: gdpr_deletion_requests
 */
export const GdprDeletionRequestsRowContract = createContract({
  name: 'GdprDeletionRequestsRow',
  version: '1',
  description: 'Database row contract for gdpr_deletion_requests table',
  schema: Schemas.GdprDeletionRequestsSelectSchema,
})

/**
 * Contract for gdprDeletionRequests insert
 * Database table: gdpr_deletion_requests
 */
export const GdprDeletionRequestsInsertContract = createContract({
  name: 'GdprDeletionRequestsInsert',
  version: '1',
  description: 'Database insert contract for gdpr_deletion_requests table',
  schema: Schemas.GdprDeletionRequestsInsertSchema,
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
// Jobs Contracts
// =============================================================================

/**
 * Contract for jobs row (Select)
 * Database table: jobs
 */
export const JobsRowContract = createContract({
  name: 'JobsRow',
  version: '1',
  description: 'Database row contract for jobs table',
  schema: Schemas.JobsSelectSchema,
})

/**
 * Contract for jobs insert
 * Database table: jobs
 */
export const JobsInsertContract = createContract({
  name: 'JobsInsert',
  version: '1',
  description: 'Database insert contract for jobs table',
  schema: Schemas.JobsInsertSchema,
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
// MagicLinks Contracts
// =============================================================================

/**
 * Contract for magicLinks row (Select)
 * Database table: magic_links
 */
export const MagicLinksRowContract = createContract({
  name: 'MagicLinksRow',
  version: '1',
  description: 'Database row contract for magic_links table',
  schema: Schemas.MagicLinksSelectSchema,
})

/**
 * Contract for magicLinks insert
 * Database table: magic_links
 */
export const MagicLinksInsertContract = createContract({
  name: 'MagicLinksInsert',
  version: '1',
  description: 'Database insert contract for magic_links table',
  schema: Schemas.MagicLinksInsertSchema,
})

// =============================================================================
// MarketplaceServers Contracts
// =============================================================================

/**
 * Contract for marketplaceServers row (Select)
 * Database table: marketplace_servers
 */
export const MarketplaceServersRowContract = createContract({
  name: 'MarketplaceServersRow',
  version: '1',
  description: 'Database row contract for marketplace_servers table',
  schema: Schemas.MarketplaceServersSelectSchema,
})

/**
 * Contract for marketplaceServers insert
 * Database table: marketplace_servers
 */
export const MarketplaceServersInsertContract = createContract({
  name: 'MarketplaceServersInsert',
  version: '1',
  description: 'Database insert contract for marketplace_servers table',
  schema: Schemas.MarketplaceServersInsertSchema,
})

// =============================================================================
// MarketplaceTransactions Contracts
// =============================================================================

/**
 * Contract for marketplaceTransactions row (Select)
 * Database table: marketplace_transactions
 */
export const MarketplaceTransactionsRowContract = createContract({
  name: 'MarketplaceTransactionsRow',
  version: '1',
  description: 'Database row contract for marketplace_transactions table',
  schema: Schemas.MarketplaceTransactionsSelectSchema,
})

/**
 * Contract for marketplaceTransactions insert
 * Database table: marketplace_transactions
 */
export const MarketplaceTransactionsInsertContract = createContract({
  name: 'MarketplaceTransactionsInsert',
  version: '1',
  description: 'Database insert contract for marketplace_transactions table',
  schema: Schemas.MarketplaceTransactionsInsertSchema,
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
// OauthAccounts Contracts
// =============================================================================

/**
 * Contract for oauthAccounts row (Select)
 * Database table: oauth_accounts
 */
export const OauthAccountsRowContract = createContract({
  name: 'OauthAccountsRow',
  version: '1',
  description: 'Database row contract for oauth_accounts table',
  schema: Schemas.OauthAccountsSelectSchema,
})

/**
 * Contract for oauthAccounts insert
 * Database table: oauth_accounts
 */
export const OauthAccountsInsertContract = createContract({
  name: 'OauthAccountsInsert',
  version: '1',
  description: 'Database insert contract for oauth_accounts table',
  schema: Schemas.OauthAccountsInsertSchema,
})

// =============================================================================
// Orders Contracts
// =============================================================================

/**
 * Contract for orders row (Select)
 * Database table: orders
 */
export const OrdersRowContract = createContract({
  name: 'OrdersRow',
  version: '1',
  description: 'Database row contract for orders table',
  schema: Schemas.OrdersSelectSchema,
})

/**
 * Contract for orders insert
 * Database table: orders
 */
export const OrdersInsertContract = createContract({
  name: 'OrdersInsert',
  version: '1',
  description: 'Database insert contract for orders table',
  schema: Schemas.OrdersInsertSchema,
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
// Passkeys Contracts
// =============================================================================

/**
 * Contract for passkeys row (Select)
 * Database table: passkeys
 */
export const PasskeysRowContract = createContract({
  name: 'PasskeysRow',
  version: '1',
  description: 'Database row contract for passkeys table',
  schema: Schemas.PasskeysSelectSchema,
})

/**
 * Contract for passkeys insert
 * Database table: passkeys
 */
export const PasskeysInsertContract = createContract({
  name: 'PasskeysInsert',
  version: '1',
  description: 'Database insert contract for passkeys table',
  schema: Schemas.PasskeysInsertSchema,
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
// ProcessedWebhookEvents Contracts
// =============================================================================

/**
 * Contract for processedWebhookEvents row (Select)
 * Database table: processed_webhook_events
 */
export const ProcessedWebhookEventsRowContract = createContract({
  name: 'ProcessedWebhookEventsRow',
  version: '1',
  description: 'Database row contract for processed_webhook_events table',
  schema: Schemas.ProcessedWebhookEventsSelectSchema,
})

/**
 * Contract for processedWebhookEvents insert
 * Database table: processed_webhook_events
 */
export const ProcessedWebhookEventsInsertContract = createContract({
  name: 'ProcessedWebhookEventsInsert',
  version: '1',
  description: 'Database insert contract for processed_webhook_events table',
  schema: Schemas.ProcessedWebhookEventsInsertSchema,
})

// =============================================================================
// Products Contracts
// =============================================================================

/**
 * Contract for products row (Select)
 * Database table: products
 */
export const ProductsRowContract = createContract({
  name: 'ProductsRow',
  version: '1',
  description: 'Database row contract for products table',
  schema: Schemas.ProductsSelectSchema,
})

/**
 * Contract for products insert
 * Database table: products
 */
export const ProductsInsertContract = createContract({
  name: 'ProductsInsert',
  version: '1',
  description: 'Database insert contract for products table',
  schema: Schemas.ProductsInsertSchema,
})

// =============================================================================
// RagChunks Contracts
// =============================================================================

/**
 * Contract for ragChunks row (Select)
 * Database table: rag_chunks
 */
export const RagChunksRowContract = createContract({
  name: 'RagChunksRow',
  version: '1',
  description: 'Database row contract for rag_chunks table',
  schema: Schemas.RagChunksSelectSchema,
})

/**
 * Contract for ragChunks insert
 * Database table: rag_chunks
 */
export const RagChunksInsertContract = createContract({
  name: 'RagChunksInsert',
  version: '1',
  description: 'Database insert contract for rag_chunks table',
  schema: Schemas.RagChunksInsertSchema,
})

// =============================================================================
// RagDocuments Contracts
// =============================================================================

/**
 * Contract for ragDocuments row (Select)
 * Database table: rag_documents
 */
export const RagDocumentsRowContract = createContract({
  name: 'RagDocumentsRow',
  version: '1',
  description: 'Database row contract for rag_documents table',
  schema: Schemas.RagDocumentsSelectSchema,
})

/**
 * Contract for ragDocuments insert
 * Database table: rag_documents
 */
export const RagDocumentsInsertContract = createContract({
  name: 'RagDocumentsInsert',
  version: '1',
  description: 'Database insert contract for rag_documents table',
  schema: Schemas.RagDocumentsInsertSchema,
})

// =============================================================================
// RagWorkspaces Contracts
// =============================================================================

/**
 * Contract for ragWorkspaces row (Select)
 * Database table: rag_workspaces
 */
export const RagWorkspacesRowContract = createContract({
  name: 'RagWorkspacesRow',
  version: '1',
  description: 'Database row contract for rag_workspaces table',
  schema: Schemas.RagWorkspacesSelectSchema,
})

/**
 * Contract for ragWorkspaces insert
 * Database table: rag_workspaces
 */
export const RagWorkspacesInsertContract = createContract({
  name: 'RagWorkspacesInsert',
  version: '1',
  description: 'Database insert contract for rag_workspaces table',
  schema: Schemas.RagWorkspacesInsertSchema,
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
// RegisteredAgents Contracts
// =============================================================================

/**
 * Contract for registeredAgents row (Select)
 * Database table: registered_agents
 */
export const RegisteredAgentsRowContract = createContract({
  name: 'RegisteredAgentsRow',
  version: '1',
  description: 'Database row contract for registered_agents table',
  schema: Schemas.RegisteredAgentsSelectSchema,
})

/**
 * Contract for registeredAgents insert
 * Database table: registered_agents
 */
export const RegisteredAgentsInsertContract = createContract({
  name: 'RegisteredAgentsInsert',
  version: '1',
  description: 'Database insert contract for registered_agents table',
  schema: Schemas.RegisteredAgentsInsertSchema,
})

// =============================================================================
// RevealcoinPayments Contracts
// =============================================================================

/**
 * Contract for revealcoinPayments row (Select)
 * Database table: revealcoin_payments
 */
export const RevealcoinPaymentsRowContract = createContract({
  name: 'RevealcoinPaymentsRow',
  version: '1',
  description: 'Database row contract for revealcoin_payments table',
  schema: Schemas.RevealcoinPaymentsSelectSchema,
})

/**
 * Contract for revealcoinPayments insert
 * Database table: revealcoin_payments
 */
export const RevealcoinPaymentsInsertContract = createContract({
  name: 'RevealcoinPaymentsInsert',
  version: '1',
  description: 'Database insert contract for revealcoin_payments table',
  schema: Schemas.RevealcoinPaymentsInsertSchema,
})

// =============================================================================
// RevealcoinPriceSnapshots Contracts
// =============================================================================

/**
 * Contract for revealcoinPriceSnapshots row (Select)
 * Database table: revealcoin_price_snapshots
 */
export const RevealcoinPriceSnapshotsRowContract = createContract({
  name: 'RevealcoinPriceSnapshotsRow',
  version: '1',
  description: 'Database row contract for revealcoin_price_snapshots table',
  schema: Schemas.RevealcoinPriceSnapshotsSelectSchema,
})

/**
 * Contract for revealcoinPriceSnapshots insert
 * Database table: revealcoin_price_snapshots
 */
export const RevealcoinPriceSnapshotsInsertContract = createContract({
  name: 'RevealcoinPriceSnapshotsInsert',
  version: '1',
  description: 'Database insert contract for revealcoin_price_snapshots table',
  schema: Schemas.RevealcoinPriceSnapshotsInsertSchema,
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
// TenantProviderConfigs Contracts
// =============================================================================

/**
 * Contract for tenantProviderConfigs row (Select)
 * Database table: tenant_provider_configs
 */
export const TenantProviderConfigsRowContract = createContract({
  name: 'TenantProviderConfigsRow',
  version: '1',
  description: 'Database row contract for tenant_provider_configs table',
  schema: Schemas.TenantProviderConfigsSelectSchema,
})

/**
 * Contract for tenantProviderConfigs insert
 * Database table: tenant_provider_configs
 */
export const TenantProviderConfigsInsertContract = createContract({
  name: 'TenantProviderConfigsInsert',
  version: '1',
  description: 'Database insert contract for tenant_provider_configs table',
  schema: Schemas.TenantProviderConfigsInsertSchema,
})

// =============================================================================
// Tenants Contracts
// =============================================================================

/**
 * Contract for tenants row (Select)
 * Database table: tenants
 */
export const TenantsRowContract = createContract({
  name: 'TenantsRow',
  version: '1',
  description: 'Database row contract for tenants table',
  schema: Schemas.TenantsSelectSchema,
})

/**
 * Contract for tenants insert
 * Database table: tenants
 */
export const TenantsInsertContract = createContract({
  name: 'TenantsInsert',
  version: '1',
  description: 'Database insert contract for tenants table',
  schema: Schemas.TenantsInsertSchema,
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
// UsageMeters Contracts
// =============================================================================

/**
 * Contract for usageMeters row (Select)
 * Database table: usage_meters
 */
export const UsageMetersRowContract = createContract({
  name: 'UsageMetersRow',
  version: '1',
  description: 'Database row contract for usage_meters table',
  schema: Schemas.UsageMetersSelectSchema,
})

/**
 * Contract for usageMeters insert
 * Database table: usage_meters
 */
export const UsageMetersInsertContract = createContract({
  name: 'UsageMetersInsert',
  version: '1',
  description: 'Database insert contract for usage_meters table',
  schema: Schemas.UsageMetersInsertSchema,
})

// =============================================================================
// UserApiKeys Contracts
// =============================================================================

/**
 * Contract for userApiKeys row (Select)
 * Database table: user_api_keys
 */
export const UserApiKeysRowContract = createContract({
  name: 'UserApiKeysRow',
  version: '1',
  description: 'Database row contract for user_api_keys table',
  schema: Schemas.UserApiKeysSelectSchema,
})

/**
 * Contract for userApiKeys insert
 * Database table: user_api_keys
 */
export const UserApiKeysInsertContract = createContract({
  name: 'UserApiKeysInsert',
  version: '1',
  description: 'Database insert contract for user_api_keys table',
  schema: Schemas.UserApiKeysInsertSchema,
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
