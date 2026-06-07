/**
 * Whether a user's top-level `role` string grants admin access — the set the
 * proxy.ts `revealui-role` cookie gate checks.
 *
 * The admin set is {owner, admin, super-admin}: `owner` is the highest DB role
 * (assigned to the bootstrap admin), `admin` is the standard admin role, and
 * `super-admin` is a forward-compat app-layer role.
 *
 * Centralized so every auth route (sign-in, sign-up, OAuth callback, passkey)
 * derives the cookie identically. They historically drifted: the #306 role
 * rename left three of them with a deduped-wrong
 * `['admin','super-admin','admin','super-admin']` that OMITTED `owner` — which
 * locked the bootstrap owner out of /admin whenever they signed in via passkey
 * or OAuth (only sign-in had been corrected). Set lookup, no authored regex.
 */
const ADMIN_ROLES: ReadonlySet<string> = new Set(['owner', 'admin', 'super-admin']);

export function isAdminRole(role: string | null | undefined): boolean {
  return role != null && ADMIN_ROLES.has(role);
}
