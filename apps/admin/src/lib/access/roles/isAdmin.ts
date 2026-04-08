import { Role } from '@/lib/access/permissions/roles';
import { hasRole } from './hasRole';

// Access function that checks if user is admin
export const isAdmin = ({ req }: { req: { user?: unknown } }) => {
  const user = req?.user as { globalRoles?: string[]; roles?: string[] } | null;

  // If no user is present, deny access
  if (!user) {
    return false;
  }

  // Check if user has admin roles
  return hasRole(user, [Role.UserSuperAdmin, Role.UserAdmin]);
};
