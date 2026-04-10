import type { RevealRequest, RevealValue } from '@revealui/core';
import type { User } from '@revealui/core/types/admin';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  items: Array<{
    product: string | number;
    quantity?: number;
    [key: string]: unknown;
  }>;
}

export interface Product {
  id: string | number;
  name: string;
  images?: ImageType[];
  category?: Category;
  price: number;
  items: CartItem[];
}

export interface ImageType {
  url: string;
}

export interface Category {
  name: string;
}

export const deletePriceFromCarts = async ({
  req,
  id,
}: {
  req: RevealRequest;
  id: string | number;
}) => {
  if (!req.revealui) {
    return;
  }

  const usersWithPriceInCart = await req.revealui.find({
    collection: 'users',
    overrideAccess: true,
    where: {
      'cart.items.product': {
        equals: id,
      },
    },
  });

  if (usersWithPriceInCart.totalDocs > 0 && req.revealui) {
    await Promise.allSettled(
      // RevealUI admin document type compatibility - docs returned as unknown, then typed
      usersWithPriceInCart.docs.map(async (user: unknown) => {
        const typedUser = user as User & { cart?: CartItem };
        const cart = typedUser.cart;
        if (!cart?.items) {
          return;
        }

        const itemsWithoutProduct = cart.items.filter((item) => {
          if (!item || typeof item !== 'object') {
            return true;
          }
          return 'product' in item && item.product !== id;
        });

        // RevealUI admin cart data structure compatibility
        const cartWithoutProduct = {
          ...cart,
          items: itemsWithoutProduct,
        } as unknown as CartItem;

        return req.revealui?.update({
          collection: 'users',
          id: typedUser.id,
          data: {
            cart: cartWithoutProduct as unknown as RevealValue,
          },
        });
      }),
    );
  }
};
