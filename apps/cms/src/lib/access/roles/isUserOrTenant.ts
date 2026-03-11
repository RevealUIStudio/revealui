import type { AccessArgs, RevealUIInstance } from '@revealui/core';
import { isSuperAdmin } from './isSuperAdmin';

// Type for user with tenant relationships
interface UserWithTenants {
  id: string | number;
  tenants?: Array<{
    tenant: number | { id: number | string };
    roles: string[];
    id?: string | null;
  }> | null;
}

export const isUserOrTenant = async (args: AccessArgs): Promise<boolean> => {
  const { req } = args;
  const user = req?.user as UserWithTenants | undefined;
  const revealui = req?.revealui as RevealUIInstance | undefined;

  // Bail if no RevealUI CMS instance
  if (!revealui) {
    return false;
  }

  // Allow super admins through
  if (await isSuperAdmin({ req })) {
    return true;
  }

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

  // Check if the user is associated with the found tenant
  const tenantWithUser = user?.tenants?.find(
    ({ tenant: userTenant }) => userTenant === foundTenant.id,
  );

  // If user exists, grant access (they're a logged-in user)
  // OR if tenant relationship exists, grant access (they're associated with this tenant)
  return user !== undefined || tenantWithUser !== undefined;
};
