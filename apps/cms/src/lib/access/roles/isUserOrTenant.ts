/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FieldAccess, PayloadRequest } from "@revealui/cms";
import { isSuperAdmin } from "./isSuperAdmin";
import { hasRole } from "./hasRole";

export const isUserOrTenant: FieldAccess<any, any> = async (args) => {
  const { req } = args;
  const user = req?.user;
  const revealui = req?.payload;

  // Bail if no RevealUI CMS instance
  if (!revealui) {
    return false;
  }

  // Allow super admins through
  if (await isSuperAdmin(args as any)) {
    return true;
  }

  const host = req.headers?.get?.("host") || "";

  const foundTenants = await revealui.find({
    collection: "tenants",
    where: { "domains.domain": { equals: host } },
    depth: 0,
    limit: 1,
    req,
  });

  if (foundTenants.totalDocs === 0) {
    return false;
  }

  // Check if the user is an admin of the found tenant
  const tenantWithUser = (user as any)?.tenants?.find(
    ({ tenant: userTenant }: { tenant: unknown }) => userTenant === foundTenants.docs[0].id,
  );
  if (user) {
    return hasRole(user as any, []);
  } else {
    return tenantWithUser !== undefined;
  }
};
