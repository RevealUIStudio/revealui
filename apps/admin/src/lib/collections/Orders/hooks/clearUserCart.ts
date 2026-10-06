import type { RevealAfterChangeHook } from '@revealui/core';
import { z } from 'zod';
import type { OrderCollectionDocument } from '../types';

export const clearUserCart: RevealAfterChangeHook<OrderCollectionDocument> = async ({
  doc,
  req,
  operation,
}) => {
  const { revealui } = req;
  if (operation === 'create' && revealui) {
    const customerId = z.string().min(1).parse(doc.customerId);

    const user = await revealui.findByID({
      collection: 'users',
      id: customerId,
    });

    if (user) {
      const updatedUser = {
        ...user,
        cart: {
          items: [],
        },
      };

      await revealui.update({
        collection: 'users',
        id: customerId,
        data: updatedUser,
      });
    }
  }

  return doc;
};
