import type { RevealAfterChangeHook } from '@revealui/core'
import type { Order } from '@revealui/core/types/cms'

export const updateUserPurchases: RevealAfterChangeHook<Order> = async ({
  doc,
  req,
  operation,
}) => {
  const { revealui } = req

  if (
    (operation === 'create' || operation === 'update') &&
    doc.orderedBy &&
    doc.items &&
    Array.isArray(doc.items) &&
    revealui
  ) {
    const orderedBy =
      typeof doc.orderedBy === 'string' ? doc.orderedBy : doc.orderedBy.toLocaleString()
    // typeof doc.orderedBy === "string" ? doc.orderedBy : doc.orderedBy.id;

    const user = await revealui.findByID({
      collection: 'users',
      id: orderedBy,
    })

    if (user) {
      await revealui.update({
        collection: 'users',
        id: orderedBy,
        data: {
          // purchases: [
          //   ...(user?.purchases?.map(
          //     (purchase) =>
          //       typeof purchase === "string" ? purchase : purchase,
          //     // eslint-disable-next-line prettier/prettier
          //     // typeof purchase === "string" ? purchase : purchase.id
          //   ) || []),
          //   ...(doc?.items?.map(({ product }: { product: Product }) =>
          //     // eslint-disable-next-line prettier/prettier
          //     typeof product === "string" ? product : product.id,
          //   ) || []),
          // ],
        },
      })
    }
  }

  return doc
}
