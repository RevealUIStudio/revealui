import type { FieldAccess, RevealUser } from '@revealui/core';
import type { Product } from '@revealui/core/types/cms';
import { Role } from '@/lib/access/permissions/roles';
import { hasRole } from '@/lib/access/roles/hasRole';
import { asDocument } from '@/lib/utils/type-guards';

// Define a type for users that may have a purchases property
// Note: purchases is not part of the base User type, but may be added dynamically by hooks
// This property is populated at runtime by the Orders collection hooks
interface UserWithPurchases extends RevealUser {
  purchases?: Array<{ id: number | string }>;
}

/**
 * Type assertion helper for user with purchases
 *
 * Note: This is a type assertion, not a runtime type guard, because the `purchases`
 * property is added dynamically by hooks (see Orders collection hooks) and may not
 * exist at type-check time. The RevealUI framework handles populating this property
 * based on order relationships at runtime.
 *
 * @param user - The user to assert as having purchases property
 * @returns User cast to UserWithPurchases, or null if user is undefined
 */
function asUserWithPurchases(user: RevealUser | undefined): UserWithPurchases | null {
  if (!user) return null;
  if (!('purchases' in user && Array.isArray((user as UserWithPurchases).purchases))) {
    return null; // hook didn't populate it — deny access
  }
  return user as UserWithPurchases;
}

// We need to prevent access to documents behind a paywall
// To do this, we check the document against the user's list of active purchases
export const checkUserPurchases: FieldAccess = async ({ req, data: doc }) => {
  const user = req?.user;

  if (!user) {
    return false;
  }

  const userWithPurchases = asUserWithPurchases(user);
  if (!userWithPurchases) {
    return false;
  }

  // Ensure the user has a valid UserRole and check for "user-super-admin" or "user-admin" role
  if (hasRole(userWithPurchases, [Role.UserSuperAdmin, Role.UserAdmin])) {
    return true;
  }

  // Check if the document is associated with the user's purchases
  if (doc && userWithPurchases.purchases && userWithPurchases.purchases.length > 0) {
    return userWithPurchases.purchases.some(
      (purchase) => asDocument<Product>(doc).id === purchase.id,
    );
  }

  return false;
};
