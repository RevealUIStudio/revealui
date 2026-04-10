import type { RevealUser } from '@revealui/core';
import type { Role } from '@/lib/access/permissions/roles';
import type { AccessLevel } from '@/lib/access/roles/hasAnyRole';
import { hasRole } from '@/lib/access/roles/hasRole';
import type { Tenant } from '../../../types/index';

export interface TenantAccess extends Tenant {
  tenantId: string; // FK to Tenant collection in RevealUI admin or Supabase
  roles: Role[]; // User's roles specific to this tenant
  accessLevel: AccessLevel; // Reflects the highest-level role within the tenant
  collection: string;
}

// Check if a user has specific roles within a tenant
export const checkTenantRoles = (user: RevealUser, tenantRoles: TenantAccess[]): boolean => {
  // Flatten out all roles from tenantRoles array and pass them to hasRole
  const rolesToCheck = tenantRoles.flatMap((tenantRole) => tenantRole.roles);

  // Pass the extracted roles to the hasRole function
  return hasRole(user, rolesToCheck);
};
