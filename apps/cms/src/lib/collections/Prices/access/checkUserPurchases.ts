import type { FieldAccess, User } from "payload";
import { checkUserRoles } from "../../../access/users/checkUserRoles";
import { Role } from "@/lib/access/permissions/roles";

interface Price {
  id: number;
}

interface UserWithPurchases extends User {
  purchases?: { id: number }[]; // Define the purchases property as an array of objects with an id
}

export const checkUserPurchases: FieldAccess<Price> = async ({
  req: { user },
  doc,
}) => {
  if (!user) {
    return false;
  }

  const userWithPurchases = user as UserWithPurchases;

  if (
    checkUserRoles(userWithPurchases, [Role.UserSuperAdmin, Role.UserAdmin])
  ) {
    return true;
  }

  // Check if the document is associated with the user's purchases
  if (
    doc &&
    userWithPurchases.purchases &&
    userWithPurchases.purchases.length > 0
  ) {
    return userWithPurchases.purchases.some(
      (purchase) => doc.id === purchase.id,
    );
  }

  return false;
};
