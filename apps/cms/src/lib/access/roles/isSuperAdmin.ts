/* eslint-disable @typescript-eslint/no-explicit-any */
import { FieldAccess } from "@revealui/cms";
import { Role } from "../permissions/roles";
import { hasRole } from "./hasRole";

export const isSuperAdmin: FieldAccess<any, any> = async ({ req }) => {
  const user = req?.user;

  // If no user is present, deny access
  if (!user) {
    return false;
  }

  const userAccess = user;

  // Check if the user has super-admin roles
  return hasRole(userAccess, [Role.UserSuperAdmin]);
};
