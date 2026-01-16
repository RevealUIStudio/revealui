/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prettier/prettier */

import type { FieldAccess, RevealUser } from '@revealui/core'
import { Role } from '@/lib/access/permissions/roles'
import type { Product } from '@revealui/types/cms'
import { checkUserRoles } from '../../../access/users/checkUserRoles'

// Define a type for users that have a purchases property
interface UserWithPurchases extends RevealUser {
  purchases?: { id: number }[] // Define the purchases property
}

// We need to prevent access to documents behind a paywall
// To do this, we check the document against the user's list of active purchases
export const checkUserPurchases: FieldAccess<Product> = async ({ req, data: doc }) => {
  const user = req?.user

  if (!user) {
    return false
  }

  const userWithPurchases = user as unknown as UserWithPurchases

  // Ensure the user has a valid UserRole and check for "user-super-admin" or "user-admin" role
  if (checkUserRoles(userWithPurchases, [Role.UserSuperAdmin, Role.UserAdmin])) {
    return true
  }

  // Check if the document is associated with the user's purchases
  if (doc && userWithPurchases.purchases && userWithPurchases.purchases.length > 0) {
    return userWithPurchases.purchases.some((purchase) => (doc as Product).id === purchase.id)
  }

  return false
}

// /* eslint-disable @typescript-eslint/no-explicit-any */
// /* eslint-disable prettier/prettier */
// // import { Product } from '@revealui/types/cms';
// import {checkUserRoles, UserRole} from "src/lib/access/users/checkUserRoles";
// import { FieldAccess } from "@revealui/core";

// interface Product {
//   id: string;
// }
// // we need to prevent access to documents behind a paywall
// // to do this we check the document against the user's list of active purchases
// export const checkUserPurchases: FieldAccess<Product> = async ({
//   req,
//   doc,
// }) => {
//   if (!user) {
//     return false;
//   }

//   if (checkUserRoles(["user-super-admin"], user as UserRole)) {
//     return true;
//   }

//   if (doc && user && typeof user === "object" && user?.purchases?.length > 0) {
//     return user.purchases?.some(
//       (purchase: { id: string }) =>
//         doc.id === (typeof purchase === "object" ? purchase.id : purchase),
//     );
//   }

//   return false;
// };
