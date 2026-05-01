/**
 * RAG Site Cleanup  -  Cascade delete for a single site
 *
 * Sites use soft-delete (`sites.deletedAt`) rather than hard-delete, so FK
 * cascades don't fire automatically. This function immediately removes all
 * RAG data belonging to a specific site so dangling rows don't accumulate.
 *
 * Affected tables (deleted in FK-safe order):
 * 1. rag_chunks      (workspaceId -> sites.id)
 * 2. rag_documents   (workspaceId -> sites.id)
 * 3. rag_workspaces  (id = sites.id)
 *
 * Designed to be called fire-and-forget from the site DELETE route.
 * Errors are caught and logged  -  they never block the site deletion response.
 */

import { eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ragChunks, ragDocuments, ragWorkspaces } from '../schema/rag.js';

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

export interface RagSiteCleanupResult {
  /** Site ID that was cleaned up */
  siteId: string;
  /** Number of RAG chunks deleted */
  ragChunksDeleted: number;
  /** Number of RAG documents deleted */
  ragDocumentsDeleted: number;
  /** Whether the RAG workspace row was deleted */
  ragWorkspaceDeleted: boolean;
}

/**
 * Logger interface matching @revealui/core observability logger.
 * Accepts a subset so callers are not forced to import the full logger.
 */
export interface CleanupLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: unknown): void;
}

// =============================================================================
// Core cleanup function
// =============================================================================

/**
 * Deletes all RAG data (chunks, documents, workspace) for a single site.
 *
 * Deletion order respects FK constraints:
 * 1. rag_chunks  (references rag_documents.id)
 * 2. rag_documents (references sites.id via workspaceId)
 * 3. rag_workspaces (id = site.id)
 *
 * @param db     - Drizzle client connected to NeonDB
 * @param siteId - The site ID whose RAG data should be removed
 * @param logger - Optional logger for observability
 * @returns Summary of what was cleaned up
 */
export async function cleanupRagDataForSite(
  db: DrizzleClient,
  siteId: string,
  logger?: CleanupLogger,
): Promise<RagSiteCleanupResult> {
  // 1. Delete all chunks belonging to this site
  const deletedChunks = await db
    .delete(ragChunks)
    .where(eq(ragChunks.workspaceId, siteId))
    .returning();

  // 2. Delete all documents belonging to this site
  const deletedDocs = await db
    .delete(ragDocuments)
    .where(eq(ragDocuments.workspaceId, siteId))
    .returning();

  // 3. Delete the workspace row (id = siteId)
  const deletedWorkspace = await db
    .delete(ragWorkspaces)
    .where(eq(ragWorkspaces.id, siteId))
    .returning();

  const result: RagSiteCleanupResult = {
    siteId,
    ragChunksDeleted: deletedChunks.length,
    ragDocumentsDeleted: deletedDocs.length,
    ragWorkspaceDeleted: deletedWorkspace.length > 0,
  };

  if (
    logger &&
    (result.ragChunksDeleted > 0 || result.ragDocumentsDeleted > 0 || result.ragWorkspaceDeleted)
  ) {
    logger.info('RAG data cleaned up for deleted site', {
      siteId: result.siteId,
      ragChunksDeleted: result.ragChunksDeleted,
      ragDocumentsDeleted: result.ragDocumentsDeleted,
      ragWorkspaceDeleted: result.ragWorkspaceDeleted,
    });
  }

  return result;
}
