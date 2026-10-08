/**
 * Resolve the sites a caller may read for admin memory, RAG, and episode scope.
 * An empty result means the request has no tenant scope. Callers must not search.
 */

import type { Database } from '@revealui/db/client';
import { getClient } from '@revealui/db/client';
import { siteCollaborators, sites } from '@revealui/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { isFleetOperator, type ShapeAuthUser, userCanAccessSite } from '@/lib/api/shape-authz';

export interface MemoryReadScope {
  /** Sites the caller may read. Never empty. */
  siteIds: string[];
}

export interface MemoryReadScopeInput {
  userId: string;
  user?: ShapeAuthUser | null;
  /** Client-supplied site. Used only when the caller can access it. */
  requestedSiteId?: string | null;
  db?: Database;
}

function normalizeSiteId(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

async function listCallerSiteIds(db: Database, userId: string): Promise<string[]> {
  const owned = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.ownerId, userId), isNull(sites.deletedAt)));

  const collaborated = await db
    .select({ id: sites.id })
    .from(siteCollaborators)
    .innerJoin(sites, eq(sites.id, siteCollaborators.siteId))
    .where(and(eq(siteCollaborators.userId, userId), isNull(sites.deletedAt)));

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of [...owned, ...collaborated]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    ids.push(row.id);
  }
  return ids;
}

/**
 * Sites this caller may search.
 * Returns null when no site can be resolved, when a requested site is not
 * accessible, or when a fleet operator does not name a live site.
 * A shell admin role does not grant every site.
 */
export async function resolveMemoryReadScope(
  input: MemoryReadScopeInput,
): Promise<MemoryReadScope | null> {
  const db = input.db ?? getClient();
  const requested = normalizeSiteId(input.requestedSiteId);

  if (isFleetOperator(input.user)) {
    if (requested.length === 0) return null;
    const [site] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.id, requested), isNull(sites.deletedAt)))
      .limit(1);
    return site ? { siteIds: [site.id] } : null;
  }

  if (requested.length > 0) {
    const allowed = await userCanAccessSite(db, input.userId, requested, input.user);
    return allowed ? { siteIds: [requested] } : null;
  }

  const siteIds = await listCallerSiteIds(db, input.userId);
  if (siteIds.length === 0) return null;
  return { siteIds };
}
