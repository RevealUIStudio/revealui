/* eslint-disable @typescript-eslint/no-explicit-any */
export const updateUserPurchases = async ({
  doc,
  req,
  operation,
}: {
  doc: any
  req: any
  operation: string
}) => {
  const { revealui } = req

  if (
    (operation === 'create' || operation === 'update') &&
    doc.orderedBy &&
    doc.items &&
    Array.isArray(doc.items)
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

  return
}
