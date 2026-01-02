import { Role } from '../permissions/roles'
import { hasRole } from './hasRole'

export const isAdminAndTenant = ({ req }: { req: { user?: unknown } }) => {
  const user = req?.user as { globalRoles?: string[]; roles?: string[] } | null

  // If no user is present, deny access
  if (!user) {
    return false
  }

  // Check if the user has the necessary roles (specify your roles accordingly)
  const hasUserAdminRole = hasRole(user, [Role.UserAdmin])
  const hasTenantAdminRole = hasRole(user, [Role.TenantAdmin])

  // Return true only if the user has both roles
  return hasUserAdminRole && hasTenantAdminRole
}

// import type { AccessResult, User } from "@revealui/cms";
// import { Tenant } from "../../../types";
// import { isSuperAdmin } from "./isSuperAdmin";
// import { isAdmin } from "./isAdmin";

// type TenantRole = "tenant-admin" | "tenant-super-admin";

// export const isAdminAndTenant = async ({
//   req,
// }: {
//   req: { user: User };
// }): Promise<AccessResult | boolean> => {
//   if (!user) return false;

//   const { tenants, lastLoggedInTenant } = user;
//   const isSuperTenant = isSuperAdmin(user);
//   const isAdminTenant = isAdmin(user);

//   if (isSuperTenant || (isAdminTenant && !lastLoggedInTenant)) return true;

//   const tenantIds = tenants
//     ?.filter(
//       ({ roles }: { roles: TenantRole }) =>
//         roles.includes("tenant-admin") || roles.includes("tenant-super-admin"),
//     )
//     .map(({ tenant }: { tenant: Tenant }) =>
//       typeof tenant === "string" ? tenant : tenant?.id,
//     )
//     .filter(Boolean); // Removes null or undefined values

//   return {
//     or: [
//       { id: { equals: user.id } },
//       { "tenants.tenant": { in: tenantIds?.length ? tenantIds : [] } },
//     ],
//   };
// };

// import { Tenant } from "@/types";
// import type { AccessResult, User } from "@revealui/cms";
// import { isAdmin } from "./isAdmin";
// import { isSuperAdmin } from "./isSuperAdmin";

// export const adminsAndSelf = async ({
//   req,
// }: {
//   req: { user: User };
// }): Promise<AccessResult | boolean> => {
//   if (!user) {
//     return false;
//   }

//   const isSuperUser = isSuperAdmin(user);
//   const isAdminUser = isAdmin(user);

//   // Allow super-admins through only if they have not scoped their user via `lastLoggedInTenant`
//   if (isSuperUser || (isAdminUser && !user?.lastLoggedInTenant)) {
//     return true;
//   }

//   // Allow users to read themselves and any users within the tenants they are admins of
//   const tenantIds = user.tenants
//     ?.map(({ tenant, roles }: { tenant: Tenant; roles: any }) =>
//       roles.includes("admin") || roles.includes("super-admin")
//         ? typeof tenant === "string"
//           ? tenant
//           : (tenant?.id ?? null)
//         : null,
//     )
//     .filter(Boolean);

//   return {
//     or: [
//       {
//         id: {
//           equals: user.id,
//         },
//       },
//       {
//         "tenants.tenant": {
//           in: tenantIds?.length ? tenantIds : [],
//         },
//       },
//     ],
//   } as AccessResult;
// };

// /* eslint-disable prettier/prettier */
// /* eslint-disable @typescript-eslint/no-explicit-any */

// import { Tenant } from '@/types'
// import type { AccessResult, User } from 'payload'
// import { isAdmin } from './isAdmin'
// import { isSuperAdmin } from './isSuperAdmin'

// export const adminsAndSelf = async ({
//   req: { user }
// }: {
//   req: { user: User }
// }): Promise<AccessResult | boolean> => {
//   if (!user) {
//     return false
//   }

//   const isSuperUser = isSuperAdmin(user)
//   const isAdminUser = isAdmin(user)

//   // Allow super-admins through only if they have not scoped their user via `lastLoggedInTenant`
//   if (isSuperUser || (isAdminUser && !user?.lastLoggedInTenant)) {
//     return true
//   }

//   // Allow users to read themselves and any users within the tenants they are admins of
//   const tenantIds = (user?.tenants as unknown as Array<{
//     tenant: Tenant
//     roles: string[]
//   }>)
//     ?.map(({ tenant, roles }) =>
//       roles.includes('admin' || 'super-admin')
//         ? typeof tenant === 'string'
//           ? tenant
//           : tenant?.id ?? null
//         : null
//     )
//     .filter(Boolean)

//   return {
//     or: [
//       {
//         id: {
//           equals: user.id
//         }
//       },
//       {
//         'tenants.tenant': {
//           in: tenantIds.length ? tenantIds : []
//         }
//       }
//     ]
//   } as AccessResult
// }

// /* eslint-disable prettier/prettier */
// /* eslint-disable @typescript-eslint/no-explicit-any */

// import { Tenant } from '@/types'
// import type { AccessResult, User } from 'payload'
// import { isAdmin } from './isAdmin'
// import { isSuperAdmin } from './isSuperAdmin'

// export const adminsAndSelf = async ({
//   req: { user }
// }: {
//   req: { user: User }
// }) => {
//   if (user) {
//     const isSuperUser = isSuperAdmin(user)
//     const isAdminUser = isAdmin(user)

//     // allow super-admins through only if they have not scoped their user via `lastLoggedInTenant`
//     if (isSuperUser || (isAdminUser && !user?.lastLoggedInTenant)) {
//       return true
//     }

//     // allow users to read themselves and any users within the tenants they are admins of
//     return {
//       or: [
//         {
//           id: {
//             equals: user.id
//           }
//         },
//         ...(isSuperUser
//           ? [
//               {
//                 'tenants.tenant': {
//                   in: [
//                     typeof user?.lastLoggedInTenant === 'string'
//                       ? user?.lastLoggedInTenant
//                       : typeof user?.lastLoggedInTenant === 'object' &&
//                           user?.lastLoggedInTenant !== null
//                         ? (
//                             user?.lastLoggedInTenant as unknown as {
//                               id: string
//                             }
//                           ).id
//                         : null
//                   ].filter(Boolean)
//                 }
//               }
//             ]
//           : [
//               {
//                 'tenants.tenant': {
//                   in:
//                     (
//                       user?.tenants as unknown as Array<{
//                         tenant: Tenant
//                         roles: string[]
//                       }>
//                     )
//                       ?.map(({ tenant, roles }) =>
//                         roles.includes('admin' || 'super-admin')
//                           ? typeof tenant === 'string'
//                             ? tenant
//                             : typeof tenant === 'object' &&
//                                 tenant !== null &&
//                                 'id' in tenant
//                               ? tenant.id
//                               : null
//                           : null
//                       )
//                       .filter(Boolean) || []
//                 }
//               }
//             ])
//       ]
//     } as AccessResult
//   }
// }

/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-explicit-any */

// import type { AccessResult, User } from 'payload'
// import { Tenant } from '../../types'
// import {isAdmin, isSuperAdmin} from '@/utils'

// export const adminsAndSelf = async ({
//   req: { user }
// }: {
//   req: { user: User }
// }) => {
//   if (user) {
//     const isSuperUser = isSuperAdmin(user)
//     const isAdminUser = isAdmin(user)

//     // allow super-admins through only if they have not scoped their user via `lastLoggedInTenant`
//     if (isSuperUser || (isAdminUser && !user?.lastLoggedInTenant)) {
//       return true
//     }

//     // allow users to read themselves and any users within the tenants they are admins of
//     return {
//       or: [
//         {
//           id: {
//             equals: user.id
//           }
//         },
//         ...(isSuperUser
//           ? [
//               {
//                 'tenants.tenant': {
//                   in: [
//                     typeof user?.lastLoggedInTenant === 'string'
//                       ? user?.lastLoggedInTenant
//                       : typeof user?.lastLoggedInTenant === 'object' &&
//                           user?.lastLoggedInTenant !== null
//                         ? (
//                             user?.lastLoggedInTenant as unknown as {
//                               id: string
//                             }
//                           ).id
//                         : null
//                   ].filter(Boolean)
//                 }
//               }
//             ]
//           : [
//               {
//                 'tenants.tenant': {
//                   in:
//                     (
//                       user?.tenants as unknown as Array<{
//                         tenant: Tenant
//                         roles: string[]
//                       }>
//                     )
//                       ?.map(({ tenant, roles }) =>
//                         roles.includes('admin' || 'super-admin')
//                           ? typeof tenant === 'string'
//                             ? tenant
//                             : typeof tenant === 'object' &&
//                                 tenant !== null &&
//                                 'id' in tenant
//                               ? tenant.id
//                               : null
//                           : null
//                       )
//                       .filter(Boolean) || []
//                 }
//               }
//             ])
//       ]
//     } as AccessResult
//   }
// }
