import { Access } from "@revealui/cms";
import { Role } from "../permissions/roles";
import { hasRole } from "./hasRole";

export const isAdminOrPublished: Access = ({ req, data }) => {
  const { user } = req;

  // If content is published, allow access immediately
  if (data?.published) {
    return true;
  }

  // If there is no user, deny access
  if (!user) {
    return false;
  }

  const userAccess = user;

  // Check if the user has admin roles
  return hasRole(userAccess, [Role.UserAdmin, Role.TenantAdmin]);
};

// import type { Access } from "@revealui/cms";
// import { isAdmin } from "./isUserAdmin";
// import { isSuperAdmin } from "./isUserSuperAdmin";

// export const adminsOrPublished: Access = ({ req: { user } }) => {
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

// export const adminsOrPublished: Access = ({ req: { user } }) => {
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

// import type { Access } from 'payload'
// import { checkUserRoles, UserRole } from '../users/checkUserRoles'

// export const adminsOrPublished: Access = ({ req: { user } }) => {
//   if (checkUserRoles(['super-admin'], user as unknown as UserRole)) {
//     return true
//   }

//   return {
//     _status: {
//       equals: 'published'
//     }
//   }
// }
