/* eslint-disable @typescript-eslint/no-explicit-any */
import { hasRole } from "../roles/hasRole";
import { Role } from "../permissions/roles";
import { User } from "payload";

// General function to check user roles
export const checkUserRoles = (
  user: User,
  requiredRoles: Role[] = [], // Use Role[] directly for clarity
): boolean => {
  return hasRole(user, requiredRoles);
};
