import type { Access } from "@revealui/cms";
import { Role } from "../permissions/roles";
import { hasRole } from "./hasRole";

export const isAdminAndUser: Access = ({ req }) => {
  const { user } = req;

  // If no user is present, deny access
  if (!user) {
    return false;
  }

  const userAccess = user;

  // Check if the user has 'user-admin' and 'tenant-admin' roles and the 'user' role
  const isUserAdmin = hasRole(userAccess, [Role.UserAdmin]);
  const isTenantAdmin = hasRole(userAccess, [Role.TenantAdmin]);
  const isUser = hasRole(userAccess, [Role.User]); // Assuming you want to check for the 'user' role

  return isUserAdmin && isTenantAdmin && isUser;
};

// export const isAdminAndUser: Access = ({ req: { user } }) => {
//   if (!user) {
//     return false; // Return early if user is null
//   }

//   // Check if the user is a super admin or admin
//   if (isSuperAdmin(user as User) || isAdmin(user as User)) {
//     return true; // Grant access to super-admin or admin
//   }

//   // Grant access if the user is accessing their own record
//   return {
//     id: {
//       equals: user.id, // Ensure the user can only access their own data
//     },
//   };
// };

// import type { Access } from "@revealui/cms";
// import { isAdmin } from "./isAdmin";
// import { isSuperAdmin } from "./isSuperAdmin";

// const adminsAndUser: Access = ({ req: { user } }) => {
//   if (!user) {
//     return false;
//   }

//   if (isSuperAdmin(user) || isAdmin(user)) {
//     return true;
//   }

//   return {
//     id: {
//       equals: user.id,
//     },
//   };
// };

// export default adminsAndUser;

// import type { Access } from 'payload'
// import { isAdmin } from './isAdmin'
// import { isSuperAdmin } from './isSuperAdmin'

// const adminsAndUser: Access = ({ req: { user } }) => {
//   if (user) {
//     if (isSuperAdmin(user) || isAdmin(user)) {
//       return true
//     }

//     return {
//       id: {
//         equals: user.id
//       }
//     }
//   }

//   return false
// }

// export default adminsAndUser

// import type { Access } from 'payload'

// import { checkUserRoles, UserRole } from '../users/checkUserRoles'

// const adminsAndUser: Access = ({ req: { user } }) => {
//   if (user) {
//     if (
//       checkUserRoles(['super-admin' || 'admin'], user as unknown as UserRole)
//     ) {
//       return true
//     }

//     return {
//       id: {
//         equals: user.id
//       }
//     }
//   }

//   return false
// }

// export default adminsAndUser
