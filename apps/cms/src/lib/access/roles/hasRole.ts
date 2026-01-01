import { User } from "@revealui/cms";
import { Role } from "@/lib/access/permissions/roles";

export const hasRole = (user: User, roles: Role[]): boolean => {
  if (!user || !user.globalRoles) return false; // Ensure user and roles are defined
  return roles.some((role) => user.globalRoles.includes(role));
};

// export const hasRole = (
//   user: User,
//   roles: Role[],
//   tenant?: Tenant
// ): boolean => {
//   const userHasRole = roles.some((role) => user.globalRoles.includes(role))

//   // Check tenant roles only if tenant is provided
//   const tenantHasRole = tenant
//     ? roles.some((role) => tenant.roles?.includes(role))
//     : false

//   return userHasRole || tenantHasRole
// }

// // Update the hasRole function to handle roles in both the User and Tenant contexts
// export const hasRole = (
//   user: User,
//   roles: Role[],
//   tenant?: Tenant,
//   // Use the Roles type for better type safety
// ): boolean => {
//   // Check if user has one of the specified roles
//   const userHasRole = roles.some((role) => user.roles?.includes(role));

//   // If tenant is provided, check if the tenant also has the specified roles
//   const tenantHasRole = tenant
//     ? roles.some((role) => tenant.roles?.includes(role))
//     : false;

//   // Return true if either user or tenant has one of the specified roles
//   return userHasRole || tenantHasRole;
// };
