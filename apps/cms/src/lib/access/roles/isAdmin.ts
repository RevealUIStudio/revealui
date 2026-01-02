import { hasRole } from "./hasRole";
import { Role } from "../permissions/roles";

// Access function that checks if user is admin
export const isAdmin = ({ req }: { req: { user?: unknown } }) => {
  const user = req?.user as { globalRoles?: string[]; roles?: string[] } | null;

  // If no user is present, deny access
  if (!user) {
    return false;
  }

  // Check if user has admin roles
  return hasRole(user, [Role.UserSuperAdmin, Role.UserAdmin]);
};

// import type { AccessArgs, User } from "@revealui/cms";
// import { isUserAdmin } from "./isUserAdmin";

// type IsAdmin = (args: AccessArgs<User>) => boolean;

// export const admins: IsAdmin = ({ req }) => {
//   if (!user) return false;

//   return isUserSuperAdmin(user) || isUserAdmin(user);
// };

// import type { AccessArgs, User } from "@revealui/cms";
// import { isSuperAdmin } from "./isSuperAdmin";
// import { isAdmin } from "./isAdmin";

// type IsAdmin = (args: AccessArgs<User>) => boolean;

// export const admins: IsAdmin = ({ req }) => {
//   if (!user) return false;

//   return isSuperAdmin(user) || isAdmin(user); // Direct return statement
// };

// import type { AccessArgs, User } from "@revealui/cms";
// import { isSuperAdmin } from "./isSuperAdmin";
// import { isAdmin } from "./isAdmin";

// type IsAdmin = (args: AccessArgs<User>) => boolean;

// export const admins: IsAdmin = ({ req }) => {
//   if (!user) {
//     return false;
//   }

//   // Check if the user is either a super-admin or admin
//   return isSuperAdmin(user) || isAdmin(user);
// };

// import type { AccessArgs, User } from 'payload'
// import { checkUserRoles, type UserRole } from '../users/checkUserRoles'

// type isAdmin = (args: AccessArgs<User>) => boolean

// export const admins: isAdmin = ({ req }) => {
//   return checkUserRoles(['super-admin', 'admin'], user as unknown as UserRole)
// }
