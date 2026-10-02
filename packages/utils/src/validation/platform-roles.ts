/** Trusted canonical user fields used by platform/content authorization. */
export interface PlatformAuthUser {
  id?: string | number;
  role?: string | null;
  emailVerified?: boolean | null;
  _json?: unknown;
}

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

export const ADMIN_ROLES: ReadonlySet<string> = new Set(['owner', 'admin', 'super-admin']);

export function isAdminRole(role: string | null | undefined): boolean {
  return role != null && ADMIN_ROLES.has(role);
}

/** Mode comes from the maintained deployment configuration, never request data. */
export function canAdministerAllContent(
  user: PlatformAuthUser | null | undefined,
  mode: 'hosted' | 'forge' | null,
): boolean {
  if (!user) return false;
  return mode === 'forge' ? isAdminRole(user.role) : isPlatformSuperAdmin(user);
}

export function canManageSiteContent(
  user: PlatformAuthUser | null | undefined,
  ownerId: string,
  mode: 'hosted' | 'forge' | null,
): boolean {
  if (!user?.id) return false;
  return String(user.id) === ownerId || canAdministerAllContent(user, mode);
}
