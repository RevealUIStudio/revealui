import type { Access } from "payload";
import { hasRole } from "./hasRole";
import { Role } from "../permissions/roles";

export const isAdmin: Access = ({ req }) => {
  const { user } = req;

  // If no user is present, deny access
  if (!user) {
    return false;
  }

  // Assuming user has the required properties
  const userAccess = user;

  // Check if user has roles (specify the roles you want to check)
  return hasRole(userAccess, [Role.UserSuperAdmin, Role.UserAdmin]);
};

// import type { AccessArgs, User } from "payload";
// import { isUserAdmin } from "./isUserAdmin";

// type IsAdmin = (args: AccessArgs<User>) => boolean;

// export const admins: IsAdmin = ({ req: { user } }) => {
//   if (!user) return false;

//   return isUserSuperAdmin(user) || isUserAdmin(user);
// };

// import type { AccessArgs, User } from "payload";
// import { isSuperAdmin } from "./isSuperAdmin";
// import { isAdmin } from "./isAdmin";

// type IsAdmin = (args: AccessArgs<User>) => boolean;

// export const admins: IsAdmin = ({ req: { user } }) => {
//   if (!user) return false;

//   return isSuperAdmin(user) || isAdmin(user); // Direct return statement
// };

// import type { AccessArgs, User } from "payload";
// import { isSuperAdmin } from "./isSuperAdmin";
// import { isAdmin } from "./isAdmin";

// type IsAdmin = (args: AccessArgs<User>) => boolean;

// export const admins: IsAdmin = ({ req: { user } }) => {
//   if (!user) {
//     return false;
//   }

//   // Check if the user is either a super-admin or admin
//   return isSuperAdmin(user) || isAdmin(user);
// };

// import type { AccessArgs, User } from 'payload'
// import { checkUserRoles, type UserRole } from '../users/checkUserRoles'

// type isAdmin = (args: AccessArgs<User>) => boolean

// export const admins: isAdmin = ({ req: { user } }) => {
//   return checkUserRoles(['super-admin', 'admin'], user as unknown as UserRole)
// }
