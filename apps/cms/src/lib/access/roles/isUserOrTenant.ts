/* eslint-disable @typescript-eslint/no-explicit-any */
import { FieldAccess } from "@revealui/cms";
import { isSuperAdmin } from "./isSuperAdmin";
import { hasRole } from "./hasRole";

export const isUserOrTenant: FieldAccess<any, any> = async (args: {
  req: PayloadRequest;
}): Promise<boolean> => {
  const {
    req,
    req: { user, payload },
  } = args;

  // Allow super admins through
  if (await isSuperAdmin(args)) {
    return true;
  }

  const host = req.headers.get("host");

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
  const tenantWithUser = user?.tenants?.find(
    ({ tenant: userTenant }) => userTenant === foundTenants.docs[0].id,
  );
  if (user) {
    // Assert the type of user if it has necessary properties
    return hasRole(user, []);
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
