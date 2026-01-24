import type { RevealRequest } from '@revealui/core'
import type { User } from '@revealui/core/types/cms'

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  items: Array<{
    product: string | number
    quantity?: number
    [key: string]: unknown
  }>
}

export interface Product {
  id: string | number
  name: string
  images?: ImageType[]
  category?: Category
  price: number
  items: CartItem[]
}

export interface ImageType {
  url: string
}

export interface Category {
  name: string
}

export const deletePriceFromCarts = async ({
  req,
  id,
}: {
  req: RevealRequest
  id: string | number
}) => {
  const usersWithPriceInCart = await req.revealui.find({
    collection: 'users',
    overrideAccess: true,
    where: {
      'cart.items.product': {
        equals: id,
      },
    },
  })

  if (usersWithPriceInCart.totalDocs > 0 && req.revealui) {
    await Promise.allSettled(
      usersWithPriceInCart.docs.map(async (user: User & { cart?: CartItem }) => {
        const cart = user.cart
        if (!cart?.items) {
          return
        }

        const itemsWithoutProduct = cart.items.filter((item) => {
          if (!item || typeof item !== 'object') {
            return true
          }
          return 'product' in item && item.product !== id
        })

        const cartWithoutProduct = {
          ...cart,
          items: itemsWithoutProduct,
        }

        return req.revealui?.update({
          collection: 'users',
          id: user.id,
          data: {
            cart: cartWithoutProduct,
          },
        })
      }),
    )
  }
}
