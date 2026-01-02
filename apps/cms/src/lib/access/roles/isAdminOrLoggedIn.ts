import { Role } from "../permissions/roles";
import { hasRole } from "./hasRole";

export const isAdminOrLoggedIn = ({ req }: { req: { user?: unknown } }) => {
  const user = req?.user as { globalRoles?: string[]; roles?: string[] } | null;

  // If no user is present, deny access
  if (!user) {
    return false;
  }

  // Check if the user has admin roles or is simply logged in
  return hasRole(user, [Role.UserAdmin, Role.TenantAdmin]) || true;
};
