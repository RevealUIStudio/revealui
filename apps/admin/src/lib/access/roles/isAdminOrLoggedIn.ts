import { Role } from '@/lib/access/permissions/roles';
import { hasRole } from './hasRole';

export const isAdminOrLoggedIn = ({ req }: { req: { user?: unknown } }) => {
  const user = req?.user as { globalRoles?: string[]; roles?: string[] } | null;

  // If no user is present, deny access
  if (!user) {
    return false;
  }

  // Check if the user has admin roles or is simply logged in
  // Since we already verified user exists, any logged-in user has access
  return hasRole(user, [Role.UserAdmin, Role.TenantAdmin]) || Boolean(user);
};
