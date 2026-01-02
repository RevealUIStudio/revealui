import { Role } from "../permissions/roles";
import { hasRole } from "./hasRole";

export const isAdminAndUser = ({ req }: { req: { user?: unknown } }) => {
  const user = req?.user as { globalRoles?: string[]; roles?: string[] } | null;

  // If no user is present, deny access
  if (!user) {
    return false;
  }

  // Check if the user has 'user-admin' and 'tenant-admin' roles and the 'user' role
  const isUserAdmin = hasRole(user, [Role.UserAdmin]);
  const isTenantAdmin = hasRole(user, [Role.TenantAdmin]);
  const isUser = hasRole(user, [Role.User]);

  return isUserAdmin && isTenantAdmin && isUser;
};

// export const isAdminAndUser: AccessFunction = ({ req }) => {
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

// import type { AccessFunction } from "@revealui/cms";
// import { isAdmin } from "./isAdmin";
// import { isSuperAdmin } from "./isSuperAdmin";

// const adminsAndUser: AccessFunction = ({ req }) => {
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

// import type { AccessFunction } from 'payload'
// import { isAdmin } from './isAdmin'
// import { isSuperAdmin } from './isSuperAdmin'

// const adminsAndUser: AccessFunction = ({ req }) => {
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

// import type { AccessFunction } from 'payload'

// import { checkUserRoles, UserRole } from '../users/checkUserRoles'

// const adminsAndUser: AccessFunction = ({ req }) => {
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
