import { Access, PayloadRequest } from "payload";
import { Role } from "../permissions/roles"; // Ensure this file exports the Role enum
import { hasRole } from "../roles/hasRole";

// General tenant access and tenant-specific access for tenant admins and super-admins
export const checkTenantAccess: Access = ({ req }: { req: PayloadRequest }) => {
  const { user: tenant } = req;

  // Ensure tenant is defined and check for super-admin or tenant-admin roles
  if (tenant && hasRole(tenant, [Role.TenantAdmin, Role.TenantSuperAdmin])) {
    return true; // Grant access if user has TenantAdmin or TenantSuperAdmin role
  }

  // If tenant is defined, check if the user is an admin of any specific tenant
  if (tenant?.tenants) {
    const tenantIds = tenant.tenants
      .map(({ tenant: tenantInfo, roles }) => {
        // Check if user has admin roles
        if (
          roles.includes(Role.TenantSuperAdmin) ||
          roles.includes(Role.TenantAdmin)
        ) {
          // Return tenant ID as a string for consistency
          return typeof tenantInfo === "number"
            ? tenantInfo.toString()
            : tenantInfo.id;
        }
        return null; // Return null if no admin roles
      })
      .filter((id): id is string => id !== null); // Filter out null values while maintaining type safety

    // Return tenant access object
    return {
      tenant: {
        in: tenantIds.length > 0 ? tenantIds : [], // Ensure an empty array is returned if no matches
      },
    };
  }

  // Default case if no tenant access is granted
  return false;
};

// Field-level access for tenant admins and super-admins (using the same logic)
export const tenantFieldAccess = checkTenantAccess;

// import { Tenant } from "@/types"
// import { Access, PayloadRequest } from "payload"
// import { Role } from "../permissions/roles"
// import { hasRole } from "../roles/hasRole"
// // import { TenantAccess } from "./checkTenantRoles"

// // General tenant access and tenant-specific access for tenant admins and super-admins
// export const checkTenantAccess: Access = ({
//   req,
// }: {
//   req: PayloadRequest
// }) => {
//   const { user: tenant } = req

//   // Ensure tenant is defined and check for super-admin or tenant-admin roles
//   if (tenant && hasRole(tenant, [Role.TenantAdmin])) {
//     return true
//   }

//   // If tenant is defined, check if the user is an admin of any specific tenant
//   if (tenant && tenant.tenants) {
//     const tenantIds = tenant.tenants
//       .map(
//         ({
//           tenant: tenantInfo, // Renaming for clarity
//           roles,
//         }: {
//           tenant: number | Tenant
//           roles: (Role.TenantSuperAdmin)[] // Adjusting type to match enum
//         }) => {
//           // Check if user has admin roles
//           if (
//             roles.includes(Role.TenantSuperAdmin)
//           ) {
//             // Return tenant ID as a string for consistency
//             return typeof tenantInfo === "number"
//               ? tenantInfo.toString()
//               : tenantInfo.id // Use the id from the Tenant object
//           }
//           return null // Return null if no admin roles
//         }
//       )
//       .filter(Boolean) // Filter out null values

//     // Return tenant access object
//     return {
//       tenant: {
//         in: tenantIds.length > 0 ? tenantIds : [], // Ensure an empty array is returned if no matches
//       },
//     }
//   }

//   // Default case if no tenant access is granted
//   return false
// }

// // Field-level access for tenant admins and super-admins (using the same logic)
// export const tenantFieldAccess = checkTenantAccess
