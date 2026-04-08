import type { Tenant } from '@revealui/core/types/cms';
import { Role } from '@/lib/access/permissions/roles';
import { hasRole, type UserWithRoles } from '@/lib/access/roles/hasRole';

// Type for the user with tenant relationships
interface UserWithTenants extends UserWithRoles {
  tenants?: Array<{
    tenant: number | Tenant;
    roles: string[];
    id?: string | null;
  }> | null;
}

// General tenant access and tenant-specific access for tenant admins and super-admins
export const checkTenantAccess = ({ req }: { req: { user?: unknown } }) => {
  // Cast user to proper type from generated types
  const user = req?.user as UserWithTenants | undefined;

  if (!user) {
    return false;
  }

  // Check for super-admin or tenant-admin global roles
  if (hasRole(user, [Role.TenantAdmin, Role.TenantSuperAdmin])) {
    return true;
  }

  // Check tenant-specific access
  const userTenants = user.tenants;
  if (userTenants && Array.isArray(userTenants)) {
    const tenantIds = userTenants
      .map(({ tenant: tenantInfo, roles }) => {
        // Check if user has admin roles for this tenant
        if (roles.includes(Role.TenantSuperAdmin) || roles.includes(Role.TenantAdmin)) {
          // Return tenant ID as a string for consistency
          if (typeof tenantInfo === 'number') {
            return tenantInfo.toString();
          }
          // If tenantInfo is a Tenant object
          if (tenantInfo && typeof tenantInfo === 'object' && 'id' in tenantInfo) {
            return String(tenantInfo.id);
          }
        }
        return null;
      })
      .filter((id): id is string => id !== null);

    // Return tenant access object
    return {
      tenant: {
        in: tenantIds.length > 0 ? tenantIds : [],
      },
    };
  }

  return false;
};

// Field-level access for tenant admins and super-admins (using the same logic)
export const tenantFieldAccess = checkTenantAccess;
