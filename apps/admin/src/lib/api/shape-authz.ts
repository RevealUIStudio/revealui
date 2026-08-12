/**
 * Shared AuthZ helpers for Electric shape proxy routes (GAP-477).
 */

import type { Database } from '@revealui/db/client';
import { siteCollaborators, sites, yjsDocuments } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';
import { isAdminRole } from '@/lib/access/roles/isAdminRole';
import { isSyncIdentifier, isUuid } from '@/lib/utils/identifier-validation';

export { isUuid };

/** True when role is owner/admin/super-admin (CMS shell admin plane). */
export function requireAdminRole(role: string | null | undefined): boolean {
  return isAdminRole(role);
}

/**
 * Whether `userId` may Electric-sync a yjs document (GAP-477 acl_resource).
 * Platform admins always may. Non-admins require a row whose owner_id matches.
 * Legacy null owner_id stays admin-only (fail-closed until stamped on write).
 */
export async function userCanAccessYjsDocument(
  db: Database,
  userId: string,
  documentId: string,
  role: string | null | undefined,
): Promise<boolean> {
  if (requireAdminRole(role)) return true;

  const [row] = await db
    .select({ ownerId: yjsDocuments.ownerId })
    .from(yjsDocuments)
    .where(eq(yjsDocuments.id, documentId))
    .limit(1);

  if (!row) return false;
  return row.ownerId != null && row.ownerId === userId;
}

/**
 * Site id safe to inline into an Electric `where` clause (sync identifier charset).
 */
export function isSafeSiteId(value: string): boolean {
  return isSyncIdentifier(value);
}

/**
 * Whether `userId` may access agent/site-scoped data for `siteId`.
 * Admins always may. Otherwise owner or site_collaborators row.
 */
export async function userCanAccessSite(
  db: Database,
  userId: string,
  siteId: string,
  role: string | null | undefined,
): Promise<boolean> {
  if (requireAdminRole(role)) return true;

  const [site] = await db
    .select({ ownerId: sites.ownerId })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!site) return false;
  if (site.ownerId === userId) return true;

  const [collaborator] = await db
    .select({ id: siteCollaborators.id })
    .from(siteCollaborators)
    .where(and(eq(siteCollaborators.siteId, siteId), eq(siteCollaborators.userId, userId)))
    .limit(1);

  return collaborator != null;
}
