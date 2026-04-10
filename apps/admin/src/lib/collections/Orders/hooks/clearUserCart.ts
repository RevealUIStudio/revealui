import type { RevealAfterChangeHook } from '@revealui/core';
import type { Order } from '@revealui/core/types/admin';

export const clearUserCart: RevealAfterChangeHook<Order> = async ({ doc, req, operation }) => {
  const { revealui } = req;

  if (operation === 'create' && doc.orderedBy && revealui) {
    const orderedBy = typeof doc.orderedBy === 'string' ? doc.orderedBy : doc.orderedBy.toString();

    const user = await revealui.findByID({
      collection: 'users',
      id: orderedBy,
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
        id: orderedBy,
        data: updatedUser,
      });
    }
  }

  return doc;
};
