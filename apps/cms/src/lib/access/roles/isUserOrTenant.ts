/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FieldAccess, PayloadRequest } from "@revealui/cms";
import { isSuperAdmin } from "./isSuperAdmin";
import { hasRole } from "./hasRole";

export const isUserOrTenant: FieldAccess<any, any> = async (args) => {
  const { req } = args;
  const user = req?.user;
  const payload = req?.payload;

  // Bail if no payload instance
  if (!payload) {
    return false;
  }

  // Allow super admins through
  if (await isSuperAdmin(args as any)) {
    return true;
  }

  const host = req.headers?.get?.("host") || "";

  const foundTenants = await payload.find({
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

// /* eslint-disable @typescript-eslint/no-explicit-any */
// import type { Access, PayloadRequest } from "@revealui/cms";
// import { isSuperAdmin } from "./isSuperAdmin";
// import { hasRole } from "./hasRole";

// export const isUserOrTenant: Access = async (args: {
//   req: PayloadRequest;
// }): Promise<boolean> => {
//   const {
//     req,
//     req: { user, payload },
//   } = args;

//   // Allow super admins through
//   if (isSuperAdmin(args)) {
//     return true;
//   }

//   const host = req.headers.get("host");

//   const foundTenants = await payload.find({
//     collection: "tenants",
//     where: { "domains.domain": { equals: host } },
//     depth: 0,
//     limit: 1,
//     req,
//   });

//   if (foundTenants.totalDocs === 0) {
//     return false;
//   }

//   // Check if the user is an admin of the found tenant
//   const tenantWithUser = user?.tenants?.find(
//     ({ tenant: userTenant }: { tenant: any }) =>
//       userTenant === foundTenants.docs[0].id,
//   );

//   return hasRole(tenantWithUser as any, []);
// };
