import { User } from "payload";
import { checkUserRoles } from "./checkUserRoles";

export const isUserAdminOrSuperAdmin = (user: User): boolean => {
  return checkUserRoles(user, []);
};
