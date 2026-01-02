import type { Tenant, User } from '@/types/revealui'
import { Role } from '../permissions/roles'
import { hasRole } from '../roles/hasRole'

// Type for the user with tenant relationships
type UserWithTenants = User & {
  tenants?: Array<{
    tenant: number | Tenant
    roles: string[]
    id?: string | null
  }> | null
}

// General tenant access and tenant-specific access for tenant admins and super-admins
export const checkTenantAccess = ({ req }: { req: { user?: unknown } }) => {
  // Cast user to proper type from generated types
  const user = req?.user as UserWithTenants | undefined

  if (!user) {
    return false
  }

  // Check for super-admin or tenant-admin global roles
  if (hasRole(user as any, [Role.TenantAdmin, Role.TenantSuperAdmin])) {
    return true
  }

  // Check tenant-specific access
  const userTenants = user.tenants
  if (userTenants && Array.isArray(userTenants)) {
    const tenantIds = userTenants
      .map(({ tenant: tenantInfo, roles }) => {
        // Check if user has admin roles for this tenant
        if (roles.includes(Role.TenantSuperAdmin) || roles.includes(Role.TenantAdmin)) {
          // Return tenant ID as a string for consistency
          if (typeof tenantInfo === 'number') {
            return tenantInfo.toString()
          }
          // If tenantInfo is a Tenant object
          if (tenantInfo && typeof tenantInfo === 'object' && 'id' in tenantInfo) {
            return String(tenantInfo.id)
          }
        }
        return null
      })
      .filter((id): id is string => id !== null)

    // Return tenant access object
    return {
      tenant: {
        in: tenantIds.length > 0 ? tenantIds : [],
      },
    }
  }

  return false
}

// Field-level access for tenant admins and super-admins (using the same logic)
export const tenantFieldAccess = checkTenantAccess

// import { Tenant } from "@/types"
// import { Access, PayloadRequest } from "@revealui/cms"
// import { Role } from "../permissions/roles"
// import { hasRole } from "../roles/hasRole"
// // import { TenantAccess } from "./checkTenantRoles"

// // General tenant access and tenant-specific access for tenant admins and super-admins
// export const checkTenantAccess: AccessFunction = ({
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
