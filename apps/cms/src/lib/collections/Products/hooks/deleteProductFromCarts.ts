import type { RevealDocument, RevealRequest } from "@revealui/core";

interface UserWithCart extends RevealDocument {
	id: string | number;
	cart?: {
		items?: Array<{
			product: string | number;
			[key: string]: unknown;
		}>;
		[key: string]: unknown;
	};
}

export const deleteProductFromCarts = async ({
	req,
	id,
}: {
	req: RevealRequest;
	id: string | number;
}) => {
	if (!req.revealui) {
		return;
	}

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
			usersWithProductInCart.docs.map(async (user: UserWithCart) => {
				const cart = user.cart;
				if (!cart || !cart.items) {
					return;
				}

				const itemsWithoutProduct = cart.items.filter(
					(item: { product: string | number }) => item.product !== id,
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
					req,
				});
			}),
		);
	}
};
