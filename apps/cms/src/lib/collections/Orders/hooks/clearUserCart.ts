/* eslint-disable @typescript-eslint/no-explicit-any */
export const clearUserCart = async ({
  doc,
  req,
  operation,
}: {
  doc: any;
  req: any;
  operation: any;
}) => {
  const { payload } = req;

  if (operation === "create" && doc.orderedBy) {
    const orderedBy =
      typeof doc.orderedBy === "string"
        ? doc.orderedBy
        : doc.orderedBy.toString();

    const user = await payload.findByID({
      collection: "users",
      id: orderedBy,
    });

    if (user) {
      const updatedUser = {
        ...user,
        cart: {
          items: [],
        },
      };

      await payload.update({
        collection: "users",
        id: orderedBy,
        data: updatedUser,
      });
    }
  }

  return;
};
