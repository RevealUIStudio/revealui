/**
 * Vector / RAG Cleanup Utility
 *
 * Removes orphaned vector data (agent memories + RAG documents/chunks) for
 * sites that have been soft-deleted in NeonDB. Runs against a single NeonDB
 * connection — historical "cross-DB" framing referred to a dual-DB (NeonDB +
 * Supabase) architecture that is being phased out; these tables now live on
 * the same database, but the soft-delete fanout is still needed because sites
 * use soft-delete (`deletedAt`) rather than hard-delete.
 *
 * Affected tables:
 * - agentMemories.siteId       -> sites.id
 * - ragDocuments.workspaceId   -> sites.id
 * - ragChunks.workspaceId      -> sites.id
 *
 * Safe to run multiple times (idempotent). Supports dry-run mode and
 * configurable batch sizes via `configureCleanup()`.
 */

import { eq, inArray, isNotNull } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { agentMemories } from '../schema/agents.js';
import { ragChunks, ragDocuments } from '../schema/rag.js';
import { sites } from '../schema/sites.js';

// =============================================================================
// Configuration (parameterization pattern)
// =============================================================================

export interface CleanupConfig {
  /** Maximum number of IDs to delete per batch (default: 500) */
  batchSize: number;
  /** When true, report what would be deleted without actually deleting (default: false) */
  dryRun: boolean;
}

const DEFAULT_CONFIG: CleanupConfig = {
  batchSize: 500,
  dryRun: false,
};

let config: CleanupConfig = { ...DEFAULT_CONFIG };

/**
 * Override cleanup configuration. Useful for tests (small batch sizes)
 * or preview runs (dry-run mode).
 */
export function configureCleanup(overrides: Partial<CleanupConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
}

// =============================================================================
// Types
// =============================================================================

/**
 * Minimal Drizzle client interface accepted by cleanup functions.
 * Covers both NeonHttpDatabase and NodePgDatabase without importing
 * the full schema generic, keeping the API flexible for callers.
 */
// biome-ignore lint/suspicious/noExplicitAny: Drizzle schema generic varies per client
type DrizzleClient = NeonHttpDatabase<any> | NodePgDatabase<any>;

export interface CleanupResult {
  /** Number of agent memories deleted (or that would be deleted in dry-run) */
  agentMemoriesDeleted: number;
  /** Number of RAG documents deleted (or that would be deleted in dry-run) */
  ragDocumentsDeleted: number;
  /** Number of RAG chunks deleted (or that would be deleted in dry-run) */
  ragChunksDeleted: number;
  /** Site IDs whose data was cleaned up */
  deletedSiteIds: string[];
  /** Whether this was a dry-run (no actual deletions) */
  dryRun: boolean;
}

// =============================================================================
// Core cleanup function
// =============================================================================

/**
 * Removes orphaned vector data (agent memories + RAG documents/chunks) for
 * sites that have been soft-deleted (sites.deletedAt IS NOT NULL).
 *
 * Steps:
 * 1. Query for soft-deleted site IDs.
 * 2. Find agentMemories / ragDocuments / ragChunks referencing those site IDs.
 * 3. Delete the orphaned records in batches.
 *
 * @param db - Drizzle client connected to NeonDB
 * @returns Summary of what was cleaned up
 */
export async function cleanupOrphanedVectorData(db: DrizzleClient): Promise<CleanupResult> {
  // 1. Find all soft-deleted site IDs
  const deletedSiteRows = await db
    .select({ id: sites.id })
    .from(sites)
    .where(isNotNull(sites.deletedAt));

  const deletedSiteIds = deletedSiteRows.map((row: { id: string }) => row.id);

  if (deletedSiteIds.length === 0) {
    return {
      agentMemoriesDeleted: 0,
      ragDocumentsDeleted: 0,
      ragChunksDeleted: 0,
      deletedSiteIds: [],
      dryRun: config.dryRun,
    };
  }

  // 2. Find orphaned records (one query per table)
  const orphanedMemoryIds = await findOrphanedMemoryIds(db, deletedSiteIds);
  const orphanedDocumentIds = await findOrphanedDocumentIds(db, deletedSiteIds);
  const orphanedChunkIds = await findOrphanedChunkIds(db, deletedSiteIds);

  // 3. Delete orphaned records (unless dry-run)
  if (!config.dryRun) {
    await deleteMemoriesById(db, orphanedMemoryIds);
    // Delete chunks before documents to respect FK ordering (chunks -> documents)
    await deleteChunksById(db, orphanedChunkIds);
    await deleteDocumentsById(db, orphanedDocumentIds);
  }

  return {
    agentMemoriesDeleted: orphanedMemoryIds.length,
    ragDocumentsDeleted: orphanedDocumentIds.length,
    ragChunksDeleted: orphanedChunkIds.length,
    deletedSiteIds,
    dryRun: config.dryRun,
  };
}

// =============================================================================
// Per-table find helpers (type-safe, no generics needed)
// =============================================================================

async function findOrphanedMemoryIds(
  db: DrizzleClient,
  deletedSiteIds: string[],
): Promise<string[]> {
  const allIds: string[] = [];
  for (let i = 0; i < deletedSiteIds.length; i += config.batchSize) {
    const batch = deletedSiteIds.slice(i, i + config.batchSize);
    const rows = await db
      .select({ id: agentMemories.id })
      .from(agentMemories)
      .where(inArray(agentMemories.siteId, batch));
    for (const row of rows) {
      allIds.push(row.id);
    }
  }
  return allIds;
}

async function findOrphanedDocumentIds(
  db: DrizzleClient,
  deletedSiteIds: string[],
): Promise<string[]> {
  const allIds: string[] = [];
  for (let i = 0; i < deletedSiteIds.length; i += config.batchSize) {
    const batch = deletedSiteIds.slice(i, i + config.batchSize);
    const rows = await db
      .select({ id: ragDocuments.id })
      .from(ragDocuments)
      .where(inArray(ragDocuments.workspaceId, batch));
    for (const row of rows) {
      allIds.push(row.id);
    }
  }
  return allIds;
}

async function findOrphanedChunkIds(
  db: DrizzleClient,
  deletedSiteIds: string[],
): Promise<string[]> {
  const allIds: string[] = [];
  for (let i = 0; i < deletedSiteIds.length; i += config.batchSize) {
    const batch = deletedSiteIds.slice(i, i + config.batchSize);
    const rows = await db
      .select({ id: ragChunks.id })
      .from(ragChunks)
      .where(inArray(ragChunks.workspaceId, batch));
    for (const row of rows) {
      allIds.push(row.id);
    }
  }
  return allIds;
}

// =============================================================================
// Per-table delete helpers
// =============================================================================

async function deleteMemoriesById(db: DrizzleClient, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += config.batchSize) {
    const batch = ids.slice(i, i + config.batchSize);
    await db.delete(agentMemories).where(inArray(agentMemories.id, batch));
  }
}

async function deleteDocumentsById(db: DrizzleClient, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += config.batchSize) {
    const batch = ids.slice(i, i + config.batchSize);
    await db.delete(ragDocuments).where(inArray(ragDocuments.id, batch));
  }
}

async function deleteChunksById(db: DrizzleClient, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += config.batchSize) {
    const batch = ids.slice(i, i + config.batchSize);
    await db.delete(ragChunks).where(inArray(ragChunks.id, batch));
  }
}

// =============================================================================
// Targeted single-site cleanup (fire-and-forget from deletion hooks)
// =============================================================================

/**
 * Removes all vector data (agent memories + RAG) for a single site. Designed
 * to be called fire-and-forget after a site is soft-deleted.
 *
 * Deletion order respects FK constraints:
 * 1. ragChunks     (references ragDocuments.id)
 * 2. ragDocuments  (references sites.id via workspaceId)
 * 3. agentMemories (references sites.id via siteId)
 *
 * @param db     - Drizzle client connected to NeonDB
 * @param siteId - The site ID whose vector data should be removed
 * @returns Summary of what was cleaned up
 */
export async function cleanupVectorDataForSite(
  db: DrizzleClient,
  siteId: string,
): Promise<{
  agentMemoriesDeleted: number;
  ragChunksDeleted: number;
  ragDocumentsDeleted: number;
}> {
  // 1. RAG chunks (child of ragDocuments)
  const deletedChunks = await db
    .delete(ragChunks)
    .where(eq(ragChunks.workspaceId, siteId))
    .returning();

  // 2. RAG documents
  const deletedDocs = await db
    .delete(ragDocuments)
    .where(eq(ragDocuments.workspaceId, siteId))
    .returning();

  // 3. Agent memories
  const deletedMemories = await db
    .delete(agentMemories)
    .where(eq(agentMemories.siteId, siteId))
    .returning();

  return {
    agentMemoriesDeleted: deletedMemories.length,
    ragChunksDeleted: deletedChunks.length,
    ragDocumentsDeleted: deletedDocs.length,
  };
}
