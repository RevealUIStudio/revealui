/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  items: Array<any>;
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
  req: any;
  id: any;
}) => {
  const usersWithPriceInCart = await req.payload.find({
    collection: "users",
    overrideAccess: true,
    where: {
      "cart.items.product": {
        equals: id,
      },
    },
  });

  if (usersWithPriceInCart.totalDocs > 0) {
    await Promise.allSettled(
      usersWithPriceInCart.docs.map(
        async (user: { cart: CartItem; id: string }) => {
          const cart = user.cart;
          const itemsWithoutProduct = cart.items.filter(
            (item: { product: Product }) => item.product !== id,
          );
          const cartWithoutProduct = {
            ...cart,
            items: itemsWithoutProduct,
          };

          return req.payload.update({
            collection: "users",
            id: user.id,
            data: {
              cart: cartWithoutProduct,
            },
          });
        },
      ),
    );
  }
};
