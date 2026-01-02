/* eslint-disable prettier/prettier */
import type { FieldHook } from '@revealui/cms'

// This hook operates on the purchases field, which is an array of strings or objects with ids
type PurchaseValue = string | { id: string }

export const resolveDuplicatePurchases: FieldHook<PurchaseValue[]> = async ({
  value,
  operation,
}) => {
  if ((operation === 'create' || operation === 'update') && value) {
    return Array.from(
      new Set(
        value?.map((purchase: PurchaseValue) =>
          typeof purchase === 'string' ? purchase : purchase.id
        ) || []
      )
    ) as unknown as PurchaseValue[]
  }

  return value
}
