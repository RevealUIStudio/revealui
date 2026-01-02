import type { FieldAccess, RevealUser } from '@revealui/cms'
import { Role } from '@/lib/access/permissions/roles'
import { checkUserRoles } from '../../../access/users/checkUserRoles'

interface Price {
  id: number
}

interface UserWithPurchases extends RevealUser {
  purchases?: { id: number }[] // Define the purchases property as an array of objects with an id
}

export const checkUserPurchases: FieldAccess<Price> = async ({ req, data: doc }) => {
  const user = req?.user

  if (!user) {
    return false
  }

  const userWithPurchases = user as UserWithPurchases

  if (checkUserRoles(userWithPurchases, [Role.UserSuperAdmin, Role.UserAdmin])) {
    return true
  }

  // Check if the document is associated with the user's purchases
  if (doc && userWithPurchases.purchases && userWithPurchases.purchases.length > 0) {
    return userWithPurchases.purchases.some((purchase) => (doc as Price).id === purchase.id)
  }

  return false
}
