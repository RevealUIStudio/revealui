/**
 * API role helpers (GAP-444).
 *
 * Pure — no Hono / session / DB imports so unit tests and route handlers can
 * share the same elevation semantics without pulling the auth package graph.
 */

/**
 * Minimal user shape for API role checks.
 * Session path already returns full DB user (includes `_json` + `emailVerified`).
 * Device-token path selects the same load-bearing fields.
 */
export interface ApiAuthUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role: string;
  emailVerified?: boolean | null;
  _json?: unknown;
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
 * Platform founder / super-admin from the admin engine's `_json.roles` plane.
 * Not a tenant `owner` — out-of-band platform elevation (GAP-444 A2).
 * Requires verified email so an unverified row cannot elevate.
 */
export function isPlatformSuperAdmin(user: ApiAuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.emailVerified !== true) return false;
  return rolesFromJson(user._json).includes('super-admin');
}

/**
 * Whether the user satisfies any of the given DB roles, or is a platform
 * super-admin when the required set includes `admin` or `owner`.
 */
export function hasApiRole(user: ApiAuthUser | null | undefined, ...roles: string[]): boolean {
  if (!user) return false;
  if (roles.includes(user.role)) return true;
  if (!isPlatformSuperAdmin(user)) return false;
  // Super-admin elevates to platform admin/owner gates only, not editor/agent.
  return roles.includes('admin') || roles.includes('owner');
}
