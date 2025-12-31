import { AccessArgs, AccessResult, User } from "payload";
import { checkUserRoles } from "../users/checkUserRoles";
import { Role } from "./roles";

export const readAccess = ({
  data,
  req: { user },
}: AccessArgs<User>): AccessResult => {
  if (!user) {
    return false; // User is not logged in
  }

  const userAccess = {
    ...user,
    globalRoles: user.roles || [], // Assuming roles exists, defaulting to an empty array
    tenants: user.tenants || [], // Ensure tenants is an array
  };

  const isPublished = data?.status === "published"; // Check if the document is published
  const isUserAdmin = checkUserRoles(userAccess, [
    Role.UserSuperAdmin,
    Role.UserAdmin,
  ]);
  const isOwner = data?.user?.id === userAccess.id; // Check if the user is the owner

  return isPublished || isUserAdmin || isOwner; // Return true if any condition is met
};
