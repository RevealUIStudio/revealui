import type { AccessArgs, RevealUIInstance } from '@revealui/core';
import type { Tenant } from '@revealui/core/types/cms';
import { Role } from '@/lib/access/permissions/roles';
import { hasRole } from '@/lib/access/roles/hasRole';
import { isSuperAdmin } from '@/lib/access/roles/isSuperAdmin';

// Type for the user with tenant relationships
interface UserWithTenants {
  id: string | number;
  roles?: string[];
  tenants?: Array<{
    tenant: number | Tenant;
    roles: string[];
    id?: string | null;
  }> | null;
  [key: string]: unknown; // Index signature for compatibility with hasRole
}

// Type guard to check if user has tenants property
function isUserWithTenants(user: unknown): user is UserWithTenants {
  return user !== null && typeof user === 'object' && 'id' in user;
}

// Check if the user is a tenant admin or super admin
export const isTenantAdminOrSuperAdmin = async ({ req }: AccessArgs): Promise<boolean> => {
  const user = req?.user;
  const revealui = req?.revealui as RevealUIInstance | undefined;

  // If no user or revealui is present, deny access
  if (!(user && isUserWithTenants(user) && revealui)) {
    return false;
  }

  // Always allow super admins
  if (await isSuperAdmin({ req })) return true;

  // Check if the user has global tenant admin roles
  if (hasRole(user as UserWithTenants, [Role.TenantAdmin, Role.TenantSuperAdmin])) {
    return true;
  }

  // Additional logic: Check if the user is an admin of the tenant by host
  const host = req.headers?.get?.('host') || '';
  const foundTenants = await revealui.find({
    collection: 'tenants',
    where: { 'domains.domain': { equals: host } },
    depth: 0,
    limit: 1,
  });

  const foundTenant = foundTenants.docs[0];
  if (!foundTenant) {
    return false;
  }

  // Check if the user is an admin of the found tenant
  const userTenants = user.tenants;
  if (!(userTenants && Array.isArray(userTenants))) {
    return false;
  }

  const tenantWithUser = userTenants.find(
    ({ tenant: userTenant }) => userTenant === foundTenant.id,
  );

  return tenantWithUser !== undefined;
};
