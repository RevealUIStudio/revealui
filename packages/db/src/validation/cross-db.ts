/**
 * Cross-Database Referential Integrity Validation
 *
 * Supabase (vector DB) tables reference NeonDB (REST DB) entities via
 * text IDs (siteId, userId). PostgreSQL cannot enforce FK constraints
 * across separate database instances, so application-level validation
 * is required before writing cross-DB references.
 *
 * Affected Supabase tables:
 * - agentMemories.siteId → sites.id (NeonDB)
 * - agentMemories.verifiedBy → users.id (NeonDB)
 * - ragDocuments.workspaceId → sites.id (NeonDB)
 * - ragChunks.workspaceId → sites.id (NeonDB)
 */

import { eq } from 'drizzle-orm';
import type { DatabaseClient } from '../client/types.js';
import { sites } from '../schema/sites.js';
import { users } from '../schema/users.js';

export class CrossDbReferenceError extends Error {
  constructor(
    public readonly table: string,
    public readonly column: string,
    public readonly referencedId: string,
  ) {
    super(`Cross-DB reference violation: ${table}.${column} = '${referencedId}' does not exist`);
    this.name = 'CrossDbReferenceError';
  }
}

/**
 * Validates that a site exists in the REST database (NeonDB).
 * Call this before inserting into Supabase tables that reference sites.id.
 */
export async function validateSiteExists(restDb: DatabaseClient, siteId: string): Promise<boolean> {
  const result = await restDb
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);
  return result.length > 0;
}

/**
 * Validates that a user exists in the REST database (NeonDB).
 * Call this before inserting into Supabase tables that reference users.id.
 */
export async function validateUserExists(restDb: DatabaseClient, userId: string): Promise<boolean> {
  const result = await restDb
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return result.length > 0;
}

/**
 * Validates cross-DB references and throws if any are invalid.
 * Use before inserting agent memories, RAG documents, etc. into Supabase.
 */
export async function assertCrossDbRefs(
  restDb: DatabaseClient,
  refs: {
    siteId?: string;
    userId?: string;
  },
): Promise<void> {
  const checks: Promise<void>[] = [];

  if (refs.siteId) {
    const siteId = refs.siteId;
    checks.push(
      validateSiteExists(restDb, siteId).then((exists) => {
        if (!exists) {
          throw new CrossDbReferenceError('supabase_table', 'siteId', siteId);
        }
      }),
    );
  }

  if (refs.userId) {
    const userId = refs.userId;
    checks.push(
      validateUserExists(restDb, userId).then((exists) => {
        if (!exists) {
          throw new CrossDbReferenceError('supabase_table', 'userId', userId);
        }
      }),
    );
  }

  await Promise.all(checks);
}

/**
 * Finds orphaned records in Supabase that reference non-existent NeonDB entities.
 * Returns IDs of orphaned records grouped by table.
 *
 * This is a diagnostic/cleanup utility — run periodically or on-demand.
 * Requires both REST and Vector database clients.
 */
export async function findOrphanedMemories(
  restDb: DatabaseClient,
  vectorDb: DatabaseClient,
): Promise<{
  orphanedBySite: string[];
  orphanedByUser: string[];
}> {
  // Import dynamically to avoid circular deps at module scope
  const { agentMemories } = await import('../schema/agents.js');

  // Get all distinct siteIds and verifiedBy from agent memories
  const memories = await vectorDb
    .select({
      id: agentMemories.id,
      siteId: agentMemories.siteId,
      verifiedBy: agentMemories.verifiedBy,
    })
    .from(agentMemories);

  const orphanedBySite: string[] = [];
  const orphanedByUser: string[] = [];

  // Batch-check site existence
  const uniqueSiteIds = [...new Set(memories.map((m) => m.siteId))];
  const existingSites = new Set<string>();
  for (const siteId of uniqueSiteIds) {
    if (await validateSiteExists(restDb, siteId)) {
      existingSites.add(siteId);
    }
  }

  // Batch-check user existence
  const uniqueUserIds = [
    ...new Set(memories.map((m) => m.verifiedBy).filter((id): id is string => id != null)),
  ];
  const existingUsers = new Set<string>();
  for (const userId of uniqueUserIds) {
    if (await validateUserExists(restDb, userId)) {
      existingUsers.add(userId);
    }
  }

  // Find orphans
  for (const memory of memories) {
    if (!existingSites.has(memory.siteId)) {
      orphanedBySite.push(memory.id);
    }
    if (memory.verifiedBy && !existingUsers.has(memory.verifiedBy)) {
      orphanedByUser.push(memory.id);
    }
  }

  return { orphanedBySite, orphanedByUser };
}
