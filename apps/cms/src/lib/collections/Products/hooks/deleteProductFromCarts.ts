/* eslint-disable @typescript-eslint/no-explicit-any */
// import {Product} from "@/types";

export const deleteProductFromCarts = async ({
  req,
  id,
}: {
  req: any;
  id: any;
}) => {
  const usersWithProductInCart = await req.revealui.find({
    collection: "users",
    overrideAccess: true,
    where: {
      "cart.items.product": {
        equals: id,
      },
    },
  });

  if (usersWithProductInCart.totalDocs > 0) {
    await Promise.allSettled(
      usersWithProductInCart.docs.map(async (user: { cart: any; id: any }) => {
        const cart = user.cart;
        const itemsWithoutProduct = cart.items.filter(
          (item: { product: any }) => item.product !== id,
        );
        const cartWithoutProduct = {
          ...cart,
          items: itemsWithoutProduct,
        };

        return req.revealui.update({
          collection: "users",
          id: user.id,
          data: {
            cart: cartWithoutProduct,
          },
        });
      }),
    );
  }
};
