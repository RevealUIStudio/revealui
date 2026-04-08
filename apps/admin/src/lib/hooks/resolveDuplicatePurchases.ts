// This hook operates on the purchases field, which is an array of strings or objects with ids
type PurchaseValue = string | { id: string };

export async function resolveDuplicatePurchases({
  value,
  operation,
}: {
  value?: PurchaseValue[];
  operation?: string;
}): Promise<PurchaseValue[] | undefined> {
  if ((operation === 'create' || operation === 'update') && value) {
    const uniqueIds = Array.from(
      new Set(
        value.map((purchase: PurchaseValue) =>
          typeof purchase === 'string' ? purchase : purchase.id,
        ),
      ),
    );
    return uniqueIds as PurchaseValue[];
  }

  return value;
}
