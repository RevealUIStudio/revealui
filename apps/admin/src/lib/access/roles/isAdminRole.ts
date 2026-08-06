/**
 * Whether a user's top-level `role` string grants CMS shell admin access —
 * the set the proxy.ts `revealui-role` cookie gate checks.
 *
 * Bounds (see packages/auth platform-roles + ADR role planes):
 * - `owner` — highest DB column role (bootstrap / primary operator)
 * - `admin` — standard CMS shell admin (hosted account owners promoted here)
 * - `super-admin` — cookie-compat only; canonical storage is `_json.roles`,
 *   not `users.role` (CHECK forbids super-admin on the column)
 *
 * Super-admin is platform operator power, not "first SaaS customer".
 * Account membership owner ≠ shell admin until users.role is admin/owner
 * (ensureAccountOwnerPlatformAdmin on account provision).
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
