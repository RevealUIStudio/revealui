import { Role } from '@/lib/access/permissions/roles';
import { hasRole } from './hasRole';

export const isAdminAndTenant = ({ req }: { req: { user?: unknown } }) => {
  const user = req?.user as { globalRoles?: string[]; roles?: string[] } | null;

  // If no user is present, deny access
  if (!user) {
    return false;
  }

  // Check if the user has the necessary roles (specify your roles accordingly)
  const hasUserAdminRole = hasRole(user, [Role.UserAdmin]);
  const hasTenantAdminRole = hasRole(user, [Role.TenantAdmin]);

  // Return true only if the user has both roles
  return hasUserAdminRole && hasTenantAdminRole;
};
