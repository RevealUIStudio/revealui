import { Role } from '@/lib/access/permissions/roles';
import { hasRole } from './hasRole';

export const isAdminOrPublished = ({
  req,
  data,
}: {
  req: { user?: unknown };
  data?: { published?: boolean; _status?: string };
}) => {
  const user = req?.user as { globalRoles?: string[]; roles?: string[] } | null;

  // If content is published, allow access immediately
  if (data?.published || data?._status === 'published') {
    return true;
  }

  // If there is no user, deny access
  if (!user) {
    return false;
  }

  // Check if the user has admin roles
  return hasRole(user, [Role.UserAdmin, Role.TenantAdmin]);
};
