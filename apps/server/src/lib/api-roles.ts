/**
 * API role helpers (GAP-444).
 *
 * Pure: no Hono / session / DB imports so unit tests and route handlers can
 * share the same elevation semantics without pulling the auth package graph.
 */

/**
 * Minimal user shape for API role checks.
 * Session path already returns full DB user (includes `_json` + `emailVerified`).
 * Device-token path selects the same load-bearing fields.
 */
import { hasAnyRole } from '@revealui/utils/validation';

export { isPlatformSuperAdmin } from '@revealui/utils/validation';

export interface ApiAuthUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role: string;
  emailVerified?: boolean | null;
  _json?: unknown;
}

/**
 * Whether the user satisfies any of the given roles on the platform ladder.
 * Owner satisfies admin and super-admin. Super-admin satisfies admin.
 * An owner-only requirement stays owner-only. Off-ladder roles stay exact.
 */
export function hasApiRole(user: ApiAuthUser | null | undefined, ...roles: string[]): boolean {
  if (!user) return false;
  return hasAnyRole(user, roles);
}
