/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prettier/prettier */

import type { FieldAccess, RevealUser } from '@revealui/core'
import type { Product } from '@revealui/core/types/cms'
import { Role } from '@/lib/access/permissions/roles'
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
