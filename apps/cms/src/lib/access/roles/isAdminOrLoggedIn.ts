import type { Access } from "payload";
import { Role } from "../permissions/roles";
import { hasRole } from "./hasRole";

export const isAdminOrLoggedIn: Access = ({ req }) => {
  const { user } = req;

  // If no user is present, deny access
  if (!user) {
    return false;
  }

  const userAccess = user;

  // Check if the user has admin roles or is simply logged in
  return hasRole(userAccess, [Role.UserAdmin, Role.TenantAdmin]) || true;
};
