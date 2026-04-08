import type { FieldBeforeChangeHook } from '@revealui/contracts/cms';
import type { RevealUser } from '@revealui/core';

// Field hook for populating orderedBy with current user ID
// Using contract type for full type safety with unknown value type for flexibility
export const populateOrderedBy: FieldBeforeChangeHook = async ({ req, operation, value }) => {
  if ((operation === 'create' || operation === 'update') && !value) {
    const user = req?.user as RevealUser | undefined;
    return user?.id ?? null;
  }

  return value;
};
