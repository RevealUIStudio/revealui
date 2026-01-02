import type { RevealUser } from "@revealui/cms";
import { checkUserRoles } from "./checkUserRoles";

export const isUserAdminOrSuperAdmin = (user: RevealUser): boolean => {
  return checkUserRoles(user, []);
};
