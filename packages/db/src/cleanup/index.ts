/**
 * Cross-Database Cleanup Utilities
 *
 * Bridges the gap between NeonDB (REST) and Supabase (vector) databases
 * by cleaning up orphaned records that FK cascades cannot reach across
 * separate database instances.
 */

export {
  cleanupOrphanedVectorData,
  type CleanupConfig,
  type CleanupResult,
  configureCleanup,
} from './cross-db-cleanup.js';
