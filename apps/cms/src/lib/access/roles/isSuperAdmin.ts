import { Role } from '@/lib/access/permissions/roles';
import { hasRole } from './hasRole';

// Access function that checks if user is a super admin
export const isSuperAdmin = async ({ req }: { req: { user?: unknown } }): Promise<boolean> => {
  const user = req?.user;

  // If no user is present, deny access
  if (!user) {
    return false;
  }

  // hasRole accepts UserWithRoles which has index signature for compatibility
  return hasRole(user as Parameters<typeof hasRole>[0], [Role.UserSuperAdmin]);
};
