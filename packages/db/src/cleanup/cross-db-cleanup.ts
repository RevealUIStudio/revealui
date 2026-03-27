/**
 * Cross-Database Cleanup Utility
 *
 * Removes orphaned vector data (Supabase) when the owning site has been
 * soft-deleted in NeonDB. PostgreSQL FK cascades cannot span separate
 * database instances, so this utility bridges the gap.
 *
 * Affected Supabase tables:
 * - agentMemories.siteId       -> sites.id (NeonDB)
 * - ragDocuments.workspaceId   -> sites.id (NeonDB)
 * - ragChunks.workspaceId      -> sites.id (NeonDB)
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
 * Removes orphaned vector data from Supabase for sites that have been
 * soft-deleted in NeonDB (sites.deletedAt IS NOT NULL).
 *
 * Steps:
 * 1. Query NeonDB for soft-deleted site IDs.
 * 2. Query Supabase for agentMemories / ragDocuments / ragChunks referencing
 *    those site IDs.
 * 3. Delete the orphaned records in batches.
 *
 * @param restDb  - Drizzle client connected to NeonDB (REST database)
 * @param vectorDb - Drizzle client connected to Supabase (vector database)
 * @returns Summary of what was cleaned up
 */
export async function cleanupOrphanedVectorData(
  restDb: DrizzleClient,
  vectorDb: DrizzleClient,
): Promise<CleanupResult> {
  // 1. Find all soft-deleted site IDs in NeonDB
  const deletedSiteRows = await restDb
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

  // 2. Find orphaned records in Supabase (one query per table)
  const orphanedMemoryIds = await findOrphanedMemoryIds(vectorDb, deletedSiteIds);
  const orphanedDocumentIds = await findOrphanedDocumentIds(vectorDb, deletedSiteIds);
  const orphanedChunkIds = await findOrphanedChunkIds(vectorDb, deletedSiteIds);

  // 3. Delete orphaned records (unless dry-run)
  if (!config.dryRun) {
    await deleteMemoriesById(vectorDb, orphanedMemoryIds);
    // Delete chunks before documents to respect FK ordering (chunks -> documents)
    await deleteChunksById(vectorDb, orphanedChunkIds);
    await deleteDocumentsById(vectorDb, orphanedDocumentIds);
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
  vectorDb: DrizzleClient,
  deletedSiteIds: string[],
): Promise<string[]> {
  const allIds: string[] = [];
  for (let i = 0; i < deletedSiteIds.length; i += config.batchSize) {
    const batch = deletedSiteIds.slice(i, i + config.batchSize);
    const rows = await vectorDb
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
  vectorDb: DrizzleClient,
  deletedSiteIds: string[],
): Promise<string[]> {
  const allIds: string[] = [];
  for (let i = 0; i < deletedSiteIds.length; i += config.batchSize) {
    const batch = deletedSiteIds.slice(i, i + config.batchSize);
    const rows = await vectorDb
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
  vectorDb: DrizzleClient,
  deletedSiteIds: string[],
): Promise<string[]> {
  const allIds: string[] = [];
  for (let i = 0; i < deletedSiteIds.length; i += config.batchSize) {
    const batch = deletedSiteIds.slice(i, i + config.batchSize);
    const rows = await vectorDb
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

async function deleteMemoriesById(vectorDb: DrizzleClient, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += config.batchSize) {
    const batch = ids.slice(i, i + config.batchSize);
    await vectorDb.delete(agentMemories).where(inArray(agentMemories.id, batch));
  }
}

async function deleteDocumentsById(vectorDb: DrizzleClient, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += config.batchSize) {
    const batch = ids.slice(i, i + config.batchSize);
    await vectorDb.delete(ragDocuments).where(inArray(ragDocuments.id, batch));
  }
}

async function deleteChunksById(vectorDb: DrizzleClient, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += config.batchSize) {
    const batch = ids.slice(i, i + config.batchSize);
    await vectorDb.delete(ragChunks).where(inArray(ragChunks.id, batch));
  }
}

// =============================================================================
// Targeted single-site cleanup (fire-and-forget from deletion hooks)
// =============================================================================

/**
 * Removes all vector data (agent memories + RAG) for a single site from
 * the Supabase vector database. Designed to be called fire-and-forget
 * after a site is soft-deleted in NeonDB.
 *
 * Deletion order respects FK constraints:
 * 1. ragChunks     (references ragDocuments.id)
 * 2. ragDocuments  (references sites.id via workspaceId)
 * 3. agentMemories (references sites.id via siteId)
 *
 * @param vectorDb - Drizzle client connected to Supabase (vector database)
 * @param siteId   - The site ID whose vector data should be removed
 * @returns Summary of what was cleaned up
 */
export async function cleanupVectorDataForSite(
  vectorDb: DrizzleClient,
  siteId: string,
): Promise<{
  agentMemoriesDeleted: number;
  ragChunksDeleted: number;
  ragDocumentsDeleted: number;
}> {
  // 1. RAG chunks (child of ragDocuments)
  const deletedChunks = await vectorDb
    .delete(ragChunks)
    .where(eq(ragChunks.workspaceId, siteId))
    .returning();

  // 2. RAG documents
  const deletedDocs = await vectorDb
    .delete(ragDocuments)
    .where(eq(ragDocuments.workspaceId, siteId))
    .returning();

  // 3. Agent memories
  const deletedMemories = await vectorDb
    .delete(agentMemories)
    .where(eq(agentMemories.siteId, siteId))
    .returning();

  return {
    agentMemoriesDeleted: deletedMemories.length,
    ragChunksDeleted: deletedChunks.length,
    ragDocumentsDeleted: deletedDocs.length,
  };
}
