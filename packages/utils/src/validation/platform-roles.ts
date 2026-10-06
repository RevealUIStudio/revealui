/**
 * Platform role ladder.
 *
 * Highest privilege first:
 *   owner > super-admin > admin
 *
 * `hasRole(subject, 'admin')` is the single admin decision. A higher ladder
 * role satisfies every lower ladder check:
 *   owner        satisfies owner, super-admin, and admin
 *   super-admin  satisfies super-admin and admin
 *   admin        satisfies admin
 *
 * Roles off the ladder (editor, viewer, user, tenant-admin, and so on)
 * match only themselves. They never elevate, and a ladder role does not
 * imply them.
 *
 * Signals, highest rank wins:
 *   - `role` (DB column or a bare role string)
 *   - app-layer `globalRoles` when that array is present (even if empty);
 *     otherwise `roles`
 *   - verified `_json.roles` super-admin (`isPlatformSuperAdmin`), which
 *     counts as super-admin rank
 *
 * Intentionally narrower than the ladder (do not route these through
 * `hasRole(..., 'super-admin')` if the caller must stay exact):
 *   - `isSuperAdmin` / `isPlatformSuperAdmin`: the super-admin marker only.
 *     Shell owner does not pass. Fleet-operator surfaces use this so a
 *     hosted account owner (promoted to shell admin) cannot read other
 *     accounts.
 *   - account membership `owner` (billing seat) is a different plane.
 *   - site collaborator `admin` is a per-site ACL, not `users.role`.
 */

/** Trusted canonical user fields used by platform/content authorization. */
export interface PlatformAuthUser {
  id?: string | number;
  role?: string | null;
  emailVerified?: boolean | null;
  _json?: unknown;
}

/** Anything a route or collection gate might hand to the ladder. */
export interface RoleCarrier extends PlatformAuthUser {
  roles?: readonly unknown[] | null;
  globalRoles?: readonly unknown[] | null;
}

export type RoleSubject = string | RoleCarrier | null | undefined;

/** Ladder order, highest privilege first. */
export const PLATFORM_ROLE_LADDER = ['owner', 'super-admin', 'admin'] as const;

export type PlatformLadderRole = (typeof PLATFORM_ROLE_LADDER)[number];

const LADDER_RANK: ReadonlyMap<string, number> = new Map([
  ['owner', 3],
  ['super-admin', 2],
  ['admin', 1],
]);

function rolesFromJson(json: unknown): string[] {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  const roles = (json as { roles?: unknown }).roles;
  if (!Array.isArray(roles)) return [];
  return roles.filter((role): role is string => typeof role === 'string');
}

/** Exact verified operator predicate formerly owned by server/api-roles. */
export function isPlatformSuperAdmin(user: PlatformAuthUser | null | undefined): boolean {
  if (user?.emailVerified !== true) return false;
  return rolesFromJson(user._json).includes('super-admin');
}

/** DB / cookie values that grant shell admin. Same set as the ladder. */
export const ADMIN_ROLES: ReadonlySet<string> = new Set(PLATFORM_ROLE_LADDER);

function isCarrier(subject: RoleSubject): subject is RoleCarrier {
  return typeof subject === 'object' && subject !== null;
}

function stringsFrom(value: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0) out.push(entry);
  }
  return out;
}

/**
 * App-layer roles. A present `globalRoles` array wins over `roles`,
 * including when it is empty.
 */
function appLayerRoles(subject: RoleCarrier): string[] {
  if (Array.isArray(subject.globalRoles)) return stringsFrom(subject.globalRoles);
  if (Array.isArray(subject.roles)) return stringsFrom(subject.roles);
  return [];
}

function heldRoles(subject: RoleSubject): string[] {
  if (typeof subject === 'string') return subject.length > 0 ? [subject] : [];
  if (!isCarrier(subject)) return [];
  const held: string[] = [];
  if (typeof subject.role === 'string' && subject.role.length > 0) held.push(subject.role);
  for (const role of appLayerRoles(subject)) held.push(role);
  return held;
}

/** Highest ladder rank held by the subject. Zero when none apply. */
export function platformRoleRank(subject: RoleSubject): number {
  let rank = 0;
  for (const role of heldRoles(subject)) {
    const next = LADDER_RANK.get(role) ?? 0;
    if (next > rank) rank = next;
  }
  if (isCarrier(subject) && isPlatformSuperAdmin(subject)) {
    const superRank = LADDER_RANK.get('super-admin') ?? 0;
    if (superRank > rank) rank = superRank;
  }
  return rank;
}

/**
 * True when the subject holds `role`, or a strictly higher ladder role
 * when `role` is on the ladder.
 */
export function hasRole(subject: RoleSubject, role: string): boolean {
  const required = LADDER_RANK.get(role);
  if (required !== undefined) return platformRoleRank(subject) >= required;
  return heldRoles(subject).includes(role);
}

/** True when any requested role matches, using ladder rules per role. */
export function hasAnyRole(subject: RoleSubject, roles: readonly string[]): boolean {
  for (const role of roles) {
    if (hasRole(subject, role)) return true;
  }
  return false;
}

/**
 * Admin gate. Owner, super-admin, and admin all pass. Editor, user, and
 * unauthenticated callers do not.
 */
export function isAdmin(subject: RoleSubject): boolean {
  return hasRole(subject, 'admin');
}

/**
 * Exact super-admin marker. Shell owner does not pass unless they also
 * carry the super-admin role or a verified `_json.roles` marker.
 * Collection gates that must stay super-admin-only (Users, Tenants) and
 * fleet-operator checks use this, not `hasRole(..., 'super-admin')`.
 */
export function isSuperAdmin(subject: RoleSubject): boolean {
  if (heldRoles(subject).includes('super-admin')) return true;
  return isCarrier(subject) && isPlatformSuperAdmin(subject);
}

/**
 * Shell admin predicate. Same answer as `isAdmin`. Accepts a role string
 * or a user object so route gates and cookie gates share one decision.
 */
export function isAdminRole(subject: RoleSubject): boolean {
  return isAdmin(subject);
}

/** Mode comes from the maintained deployment configuration, never request data. */
export function canAdministerAllContent(
  user: PlatformAuthUser | null | undefined,
  mode: 'hosted' | 'forge' | null,
): boolean {
  if (!user) return false;
  // Forge shell admin is the role column. Hosted global authority stays the
  // verified operator marker, which is narrower than shell owner/admin.
  return mode === 'forge' ? isAdmin(user.role) : isPlatformSuperAdmin(user);
}

export function canManageSiteContent(
  user: PlatformAuthUser | null | undefined,
  ownerId: string,
  mode: 'hosted' | 'forge' | null,
): boolean {
  if (!user?.id) return false;
  return String(user.id) === ownerId || canAdministerAllContent(user, mode);
}
