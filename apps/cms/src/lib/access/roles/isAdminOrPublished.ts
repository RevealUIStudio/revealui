import { Role } from '../permissions/roles'
import { hasRole } from './hasRole'

export const isAdminOrPublished = ({ req, data }: { req: { user?: unknown }; data?: { published?: boolean; _status?: string } }) => {
  const user = req?.user as { globalRoles?: string[]; roles?: string[] } | null

  // If content is published, allow access immediately
  if (data?.published || data?._status === 'published') {
    return true
  }

  // If there is no user, deny access
  if (!user) {
    return false
  }

  // Check if the user has admin roles
  return hasRole(user, [Role.UserAdmin, Role.TenantAdmin])
}

// import type { AccessFunction } from "@revealui/cms";
// import { isAdmin } from "./isUserAdmin";
// import { isSuperAdmin } from "./isUserSuperAdmin";

// export const adminsOrPublished: AccessFunction = ({ req }) => {
//   // Check if the user is either a Super Admin or an Admin
//   if (user && (isSuperAdmin(user) || isAdmin(user))) {
//     return true;
//   }

//   // If the user is not an Admin, only allow access to published items
//   return {
//     _status: {
//       equals: "published",
//     },
//   };
// };

// import type { Access, User } from 'payload'
// import { isAdmin } from './isAdmin'
// import { isSuperAdmin } from './isSuperAdmin'

// export const adminsOrPublished: AccessFunction = ({ req }) => {
//   // Check if the user is either a Super Admin or an Admin
//   if (isSuperAdmin(user as User) || isAdmin(user as User)) {
//     return true
//   }

//   // If the user is not an Admin, only allow access to published items
//   return {
//     _status: {
//       equals: 'published'
//     }
//   }
// }

// import type { AccessFunction } from 'payload'
// import { checkUserRoles, UserRole } from '../users/checkUserRoles'

// export const adminsOrPublished: AccessFunction = ({ req }) => {
//   if (checkUserRoles(['super-admin'], user as unknown as UserRole)) {
//     return true
//   }

//   return {
//     _status: {
//       equals: 'published'
//     }
//   }
// }
