import type { Role } from '@/lib/access/permissions/roles';

// User type with roles - matches the actual structure from RevealUI CMS
// Using index signature for maximum compatibility
export interface UserWithRoles {
  id?: string | number;
  globalRoles?: string[];
  roles?: string[];
  tenants?: unknown;
  [key: string]: unknown;
}

export const hasRole = (user: UserWithRoles | null | undefined, roles: Role[]): boolean => {
  if (!user) return false;
  const userRoles = user.globalRoles || user.roles;
  if (!(userRoles && Array.isArray(userRoles))) return false;
  return roles.some((role) => (userRoles as string[]).includes(role));
};
