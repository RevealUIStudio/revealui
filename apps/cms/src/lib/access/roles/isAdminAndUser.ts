import { Role } from '@/lib/access/permissions/roles';
import { hasRole } from './hasRole';

/**
 * Access control: allows admins or the user themselves.
 *
 * Used for update operations where an admin can modify any user,
 * or a user can modify their own record.
 */
export const isAdminAndUser = ({ req, id }: { req: { user?: unknown }; id?: string | number }) => {
  const user = req?.user as {
    id?: string | number;
    globalRoles?: string[];
    roles?: string[];
  } | null;

  // If no user is present, deny access
  if (!user) {
    return false;
  }

  // Admins can update any user
  const isUserAdmin = hasRole(user, [Role.UserAdmin, Role.UserSuperAdmin]);
  if (isUserAdmin) {
    return true;
  }

  // Users can update their own record
  if (id && user.id && String(user.id) === String(id)) {
    return true;
  }

  return false;
};
