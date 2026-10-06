import type { RevealAfterChangeHook } from '@revealui/core';
import { z } from 'zod';
import type { OrderCollectionDocument } from '../types';

const existingPurchasesSchema = z.array(z.union([z.string(), z.object({ id: z.string() })]));
const orderItemsSchema = z
  .array(
    z
      .object({
        productId: z.string().min(1),
        title: z.string().min(1),
        quantity: z.number().int().positive(),
        priceInCents: z.number().int().nonnegative(),
      })
      .strict(),
  )
  .max(100);

export const updateUserPurchases: RevealAfterChangeHook<OrderCollectionDocument> = async ({
  doc,
  req,
  operation,
}) => {
  const { revealui } = req;
  const items = orderItemsSchema.parse(doc.items);

  if (
    (operation === 'create' || operation === 'update') &&
    doc.customerId &&
    items.length > 0 &&
    revealui
  ) {
    const user = await revealui.findByID({
      collection: 'users',
      id: doc.customerId,
    });

    if (user) {
      const existingPurchases =
        user.purchases === undefined || user.purchases === null
          ? []
          : existingPurchasesSchema
              .parse(user.purchases)
              .map((purchase) => (typeof purchase === 'string' ? purchase : purchase.id));
      const allPurchases = [
        ...new Set([...existingPurchases, ...items.map((item) => item.productId)]),
      ];

      await revealui.update({
        collection: 'users',
        id: doc.customerId,
        data: {
          purchases: allPurchases,
        },
      });
    }
  }

  return doc;
};
