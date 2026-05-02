/**
 * Cleanup Utilities
 *
 * Soft-delete fanout cleanup for sites and their dependent vector / RAG /
 * log / token rows on NeonDB. Sites use soft-delete (`deletedAt`) rather
 * than hard-delete, so FK cascades don't fire automatically — these helpers
 * remove orphaned rows in batches with idempotent dry-run support.
 */

export {
  type CleanupConfig,
  type CleanupResult,
  cleanupOrphanedVectorData,
  cleanupVectorDataForSite,
  configureCleanup,
} from './cross-db-cleanup.js';
export {
  type CleanupLogsOptions,
  type CleanupLogsResult,
  cleanupOldLogs,
  type LogRetentionTable,
} from './log-retention.js';
export {
  type CleanupOperationalOptions,
  type CleanupOperationalResult,
  cleanupOperational,
  type OperationalRetentionTable,
} from './operational-retention.js';
export { cleanupRagDataForSite } from './rag-site-cleanup.js';
export {
  type CleanupTable,
  cleanupStaleTokens,
  type StaleTokenCleanupOptions,
  type StaleTokenCleanupResult,
} from './stale-tokens.js';
