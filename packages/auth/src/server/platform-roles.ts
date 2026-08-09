/**
 * Platform role plane (users.role + _json.roles) — durable bounds.
 *
 * Orthogonal to billing:
 * - account_memberships.role (owner|admin|member) — workspace seat
 * - account_entitlements.tier — paid features
 *
 * Super-admin is platform operator only (lives in _json.roles, never as
 * the sole meaning of "first user of a customer account").
 *
 * Account membership owner of a hosted workspace gets CMS shell access
 * via users.role = admin so proxy isAdminRole + /settings (API keys) work.
 * That is NOT super-admin.
 */

import type { Database } from '@revealui/db/client';
import { accountMemberships, users } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';

/** DB column values that already pass isAdminRole / shell admin cookie gate. */
export const PLATFORM_SHELL_ADMIN_ROLES: ReadonlySet<string> = new Set(['owner', 'admin']);

/**
 * Cookie/proxy admin set (isAdminRole). Includes super-admin for cookie
 * compatibility; super-admin must not be written to users.role (CHECK forbids it).
 */
export const PLATFORM_SHELL_ADMIN_COOKIE_ROLES: ReadonlySet<string> = new Set([
  'owner',
  'admin',
  'super-admin',
]);

/**
 * When a user becomes (or is) billing account owner, ensure they can use
 * workspace admin surfaces. Promote non-admin DB roles to `admin`.
 * Never demote owner/admin. Never assign super-admin.
 */
export function platformRoleForAccountOwner(currentRole: string): string {
  if (PLATFORM_SHELL_ADMIN_ROLES.has(currentRole)) {
    return currentRole;
  }
  return 'admin';
}

export function isPlatformShellAdminRole(role: string | null | undefined): boolean {
  return role != null && PLATFORM_SHELL_ADMIN_COOKIE_ROLES.has(role);
}

/**
 * Promote users.role to admin when the user is (or becomes) an account
 * membership owner and currently lacks shell admin. Idempotent; never demotes.
 *
 * Call sites: personal-account provision at signup, Stripe ensureHostedAccount,
 * grant-entitlement --create-account, OAuth hosted provision.
 */
export async function ensureAccountOwnerPlatformAdmin(
  db: Database,
  userId: string,
): Promise<{ previousRole: string; nextRole: string; updated: boolean } | null> {
  const [row] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  const previousRole = row.role;
  const nextRole = platformRoleForAccountOwner(previousRole);
  if (nextRole === previousRole) {
    return { previousRole, nextRole, updated: false };
  }

  await db.update(users).set({ role: nextRole }).where(eq(users.id, userId));
  return { previousRole, nextRole, updated: true };
}

/**
 * If the user has an active account_memberships.owner seat, ensure users.role
 * is shell-admin (admin/owner). No-op for members/admins who are not owners.
 *
 * GAP-473 residual: accounts provisioned before ensureAccountOwnerPlatformAdmin
 * (or any race that left membership owner + users.role=viewer) get shell access
 * on the next session mint without a manual backfill. Never promotes non-owners.
 *
 * Best-effort call sites: createSession (covers password/MFA/passkey/OAuth mint).
 */
export async function ensureShellAdminIfAccountOwner(
  db: Database,
  userId: string,
): Promise<{ previousRole: string; nextRole: string; updated: boolean } | null> {
  const [membership] = await db
    .select({ id: accountMemberships.id })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.userId, userId),
        eq(accountMemberships.role, 'owner'),
        eq(accountMemberships.status, 'active'),
      ),
    )
    .limit(1);

  if (!membership) {
    return null;
  }

  return ensureAccountOwnerPlatformAdmin(db, userId);
}

/** Fresh users.role after session mint / shell repair (for revealui-role cookie). */
export async function readUsersRole(db: Database, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.role ?? null;
}
