/**
 * Server-side admin/owner role gate.
 *
 * Single source of truth for "does this DB role grant admin-level access to
 * admin/owner-gated REST routes". Consolidates the per-route
 * `ADMIN_ROLES = new Set(['admin', 'super-admin'])` guards that previously
 * lived inline in content/users, admin/coordination, and admin/inference-config.
 *
 * The gate input is the DB `role` column (users_role_check:
 * owner/admin/editor/viewer/agent/contributor). An owner account carries DB
 * role='owner' (canonical per #1219), so 'owner' MUST grant admin-level access
 * alongside the legacy 'admin'.
 *
 * 'super-admin' is an app-layer role — it lives in `_json.roles`, not the DB
 * `role` column, so it never appears as a DB `role` value in practice. It is
 * kept in the set for parity with the pre-existing route guards this
 * consolidates (harmless: no real DB row carries it).
 *
 * Mirrors apps/admin/src/lib/access/roles/isAdminRole.ts on the admin side.
 */

import { type ApiAuthUser, isPlatformSuperAdmin } from './api-roles.js';

/** DB roles that grant admin-level access to admin/owner-gated server routes. */
export const ADMIN_ROLES: ReadonlySet<string> = new Set(['owner', 'admin', 'super-admin']);

/** True when the given DB role grants admin-level access. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role != null && ADMIN_ROLES.has(role);
}

/**
 * Fleet-wide operator surfaces (logs, margin). Tenant owner/admin is not
 * enough — membership owners are auto-promoted to shell admin and must not
 * read other accounts.
 */
export function isFleetOperator(user: ApiAuthUser | null | undefined): boolean {
  return isPlatformSuperAdmin(user);
}
