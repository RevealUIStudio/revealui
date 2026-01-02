import { Role } from '@/lib/access/permissions/roles'

// User type with roles - matches the actual structure from Payload
// Using index signature for maximum compatibility
export interface UserWithRoles {
  id?: string | number
  globalRoles?: string[]
  roles?: string[]
  tenants?: unknown
  [key: string]: unknown
}

export const hasRole = (user: UserWithRoles | null | undefined, roles: Role[]): boolean => {
  if (!user) return false
  const userRoles = user.globalRoles || user.roles
  if (!userRoles || !Array.isArray(userRoles)) return false
  return roles.some((role) => (userRoles as string[]).includes(role))
}

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
