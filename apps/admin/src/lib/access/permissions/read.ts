import { hasRole } from '@/lib/access/roles/hasRole';
import { Role } from './roles';

export const readAccess = ({
  data,
  req,
}: {
  data?: { status?: string; _status?: string; user?: { id?: string | number } };
  req: { user?: unknown };
}) => {
  const user = req?.user as {
    id?: string | number;
    globalRoles?: string[];
    roles?: string[];
    tenants?: unknown[];
  } | null;
  if (!user) {
    return false; // User is not logged in
  }

  const isPublished = data?.status === 'published' || data?._status === 'published';
  const isUserAdmin = hasRole(user, [Role.UserSuperAdmin, Role.UserAdmin]);
  const isOwner = data?.user?.id === user.id;

  return isPublished || isUserAdmin || isOwner;
};
