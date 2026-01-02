/* eslint-disable prettier/prettier */
// This hook operates on the purchases field, which is an array of strings or objects with ids
type PurchaseValue = string | { id: string }

export const resolveDuplicatePurchases = async ({
  value,
  operation,
}: {
  value?: PurchaseValue[];
  operation?: string;
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
