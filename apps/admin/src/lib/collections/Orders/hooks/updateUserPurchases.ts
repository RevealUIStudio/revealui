import type { RevealAfterChangeHook } from '@revealui/core';
import type { Order } from '@revealui/core/types/cms';

export const updateUserPurchases: RevealAfterChangeHook<Order> = async ({
  doc,
  req,
  operation,
}) => {
  const { revealui } = req;

  if (
    (operation === 'create' || operation === 'update') &&
    doc.orderedBy &&
    doc.items &&
    Array.isArray(doc.items) &&
    revealui
  ) {
    const orderedBy =
      typeof doc.orderedBy === 'string' ? doc.orderedBy : doc.orderedBy.toLocaleString();
    // typeof doc.orderedBy === "string" ? doc.orderedBy : doc.orderedBy.id;

    const user = await revealui.findByID({
      collection: 'users',
      id: orderedBy,
    });

    if (user) {
      // Collect existing purchase IDs
      const existingPurchases: string[] = Array.isArray((user as Record<string, unknown>).purchases)
        ? ((user as Record<string, unknown>).purchases as Array<string | { id: string }>).map(
            (purchase) => (typeof purchase === 'string' ? purchase : purchase.id),
          )
        : [];

      // Extract new product IDs from order items
      const newProductIds: string[] = doc.items
        .map((item) => {
          const product = (item as Record<string, unknown>).product;
          if (typeof product === 'string') return product;
          if (product !== null && typeof product === 'object' && 'id' in product) {
            return String((product as { id: unknown }).id);
          }
          return undefined;
        })
        .filter((id): id is string => typeof id === 'string');

      // Merge and deduplicate
      const allPurchases = [...new Set([...existingPurchases, ...newProductIds])];

      await revealui.update({
        collection: 'users',
        id: orderedBy,
        data: {
          purchases: allPurchases,
        },
      });
    }
  }

  return doc;
};
