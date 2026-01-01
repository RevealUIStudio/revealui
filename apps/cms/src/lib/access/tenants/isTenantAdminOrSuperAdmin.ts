/* eslint-disable @typescript-eslint/no-explicit-any */
import { FieldAccess } from "revealui/cms";
import { Role } from "../permissions/roles";
import { hasRole } from "../roles/hasRole";
import { isSuperAdmin } from "../roles/isSuperAdmin";

// Check if the user is a tenant admin or super admin
export const isTenantAdminOrSuperAdmin: FieldAccess<any, any> = async ({
  req,
}: {
  req: PayloadRequest;
}): Promise<boolean> => {
  const { user, payload } = req;

  // If no user is present, deny access
  if (!user) {
    return false;
  }

  // Always allow super admins
  if (await isSuperAdmin({ req })) return true;

  const userAccess = user; // Ensure correct type if needed

  // Check if the user has any roles
  if (hasRole(userAccess, [Role.TenantAdmin, Role.TenantSuperAdmin])) {
    return true; // Return true if user has tenant admin or super admin roles
  }

  // Additional logic: Check if the user is an admin of the tenant by host
  const host = req.headers.get("host");
  const foundTenants = await payload.find({
    collection: "tenants",
    where: { "domains.domain": { equals: host } },
    depth: 0,
    limit: 1,
    req,
  });

  if (foundTenants.totalDocs === 0) {
    return false; // No tenants found, deny access
  }

  // Check if the user is an admin of the found tenant
  const tenantWithUser = user.tenants?.find(
    ({ tenant: userTenant }) => userTenant === foundTenants.docs[0].id,
  );

  // Return true if tenantWithUser exists, false otherwise
  return tenantWithUser !== undefined;
};
