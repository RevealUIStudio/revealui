import { Role } from '@/lib/access/permissions/roles';
import { hasRole } from '@/lib/access/roles/hasRole';

export const adminsOrOrderedBy = ({ req }: { req: { user?: unknown } }) => {
  const user = req?.user as {
    id?: string | number;
    globalRoles?: string[];
    roles?: string[];
  } | null;

  if (!user) {
    return false;
  }

  if (hasRole(user, [Role.TenantSuperAdmin])) {
    return true;
  }

  // Allow access if the order was made by the logged-in user
  return {
    orderedBy: {
      equals: user.id,
    },
  };
};
