/**
 * Shared AuthZ helpers for Electric shape proxy routes (GAP-477).
 *
 * CMS shell `admin`/`owner` is not fleet-operator. Hosted account owners are
 * promoted to shell admin and must stay site/doc scoped. Full-table fleet
 * shapes require a verified `_json.roles` super-admin (same bar as
 * apps/server `isFleetOperator` / `isPlatformSuperAdmin`).
 */

import type { Database } from '@revealui/db/client';
import { siteCollaborators, sites, yjsDocuments } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';
import { isAdminRole } from '@/lib/access/roles/isAdminRole';
import { isSyncIdentifier, isUuid } from '@/lib/utils/identifier-validation';

export { isUuid };

/** Session fields the fleet-operator check reads. Extra keys are fine. */
export interface ShapeAuthUser {
  id?: string;
  role?: string | null;
  emailVerified?: boolean | null;
  _json?: unknown;
}

/** True when role is owner/admin/super-admin (CMS shell admin plane). */
export function requireAdminRole(role: string | null | undefined): boolean {
  return isAdminRole(role);
}

function rolesFromJson(json: unknown): string[] {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return [];
  }
  const roles = (json as { roles?: unknown }).roles;
  if (!Array.isArray(roles)) {
    return [];
  }
  return roles.filter((role): role is string => typeof role === 'string');
}

/**
 * Platform founder / super-admin. Tenant owner/admin is not enough.
 * Requires verified email so an unverified row cannot elevate.
 */
export function isFleetOperator(user: ShapeAuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.emailVerified !== true) return false;
  return rolesFromJson(user._json).includes('super-admin');
}

/**
 * Whether `userId` may Electric-sync a yjs document (GAP-477 acl_resource).
 * Fleet operators always may. Non-operators require a row whose owner_id matches.
 * Legacy null owner_id stays operator-only (fail-closed until stamped on write).
 */
export async function userCanAccessYjsDocument(
  db: Database,
  userId: string,
  documentId: string,
  user: ShapeAuthUser | null | undefined,
): Promise<boolean> {
  if (isFleetOperator(user)) return true;

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
 * Fleet operators always may. Otherwise owner or site_collaborators row.
 */
export async function userCanAccessSite(
  db: Database,
  userId: string,
  siteId: string,
  user: ShapeAuthUser | null | undefined,
): Promise<boolean> {
  if (isFleetOperator(user)) return true;

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
