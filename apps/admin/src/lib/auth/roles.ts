/**
 * App-layer role grants for account bootstrap.
 *
 * Companion to ./tos.ts: where that file stamps the typed TOS columns, this one
 * stamps the app-layer `roles` array into the `_json` blob via a typed Drizzle
 * write. The two are separate because they protect different surfaces — TOS is
 * legal-compliance metadata; `_json.roles` is what the engine's access gates
 * (isSuperAdmin / isAdmin via hasRole) actually read.
 *
 * Why this exists: the DB `role` column is CHECK-constrained to
 * owner/admin/editor/viewer/agent/contributor, so the app-level 'super-admin'
 * CANNOT live there — it lives in `_json.roles`. A first user promoted to DB
 * role 'admin'/'owner' but with no `_json.roles` is denied by every engine gate
 * (the founder's bug). Canonical **system** bootstrap shape (per #1219): DB
 * role='owner' + _json.roles=['super-admin'].
 *
 * Separate from hosted **account membership owner** → shell admin (users.role
 * admin, never super-admin): packages/auth ensureAccountOwnerPlatformAdmin.
 * ADR: 2026-08-05-role-planes-owner-admin-super-admin.
 *
 * A typed Drizzle write is required for the same reason ./tos.ts documents: the
 * engine's dynamic-SQL create path can write `roles` into `_json`, but the
 * /sign-up route creates users via a typed insert that never populates it, so
 * the grant has to be applied as a typed update afterward.
 */

import type { Database } from '@revealui/db/client';
import { eq } from '@revealui/db/orm';
import { users } from '@revealui/db/schema';

/**
 * App-layer roles granted to the first user / an owner account. Stored in
 * `_json.roles` (NOT the DB `role` column). Single source for the value so the
 * sign-up route and tests don't re-inline the string.
 */
export const SUPER_ADMIN_ROLES = ['super-admin'] as const;

/**
 * Grant the super-admin app-layer role to a user via a typed Drizzle write,
 * mirroring {@link import('./tos').stampTosAcceptanceByEmail}. Merges into any
 * existing `_json`, preserving other keys and de-duplicating roles, so it is
 * idempotent and safe to call on a user that already has roles.
 */
export async function grantSuperAdminRoleById(db: Database, id: string): Promise<void> {
  const [existing] = await db
    .select({ json: users._json })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  const currentJson =
    existing?.json && typeof existing.json === 'object' && !Array.isArray(existing.json)
      ? (existing.json as Record<string, unknown>)
      : {};
  const currentRoles = Array.isArray(currentJson.roles) ? (currentJson.roles as string[]) : [];
  const mergedRoles = Array.from(new Set([...currentRoles, ...SUPER_ADMIN_ROLES]));

  await db
    .update(users)
    .set({ _json: { ...currentJson, roles: mergedRoles } })
    .where(eq(users.id, id));
}
