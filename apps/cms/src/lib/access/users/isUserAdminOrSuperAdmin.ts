import { User } from "@revealui/cms";
import { checkUserRoles } from "./checkUserRoles";

export const isUserAdminOrSuperAdmin = (user: User): boolean => {
  return checkUserRoles(user, []);
};
