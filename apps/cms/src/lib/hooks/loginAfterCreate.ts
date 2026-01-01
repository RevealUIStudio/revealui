import type { CollectionAfterChangeHook } from "@revealui/cms"

export const loginAfterCreate: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
}) => {
  if (operation === "create" && !req.user) {
    const { payload } = req

    // In PayloadCMS 3.x, access body data from the doc itself
    const email = doc.email
    const password = req.data?.password

    if (email && password) {
      const { user, token } = await payload.login({
        collection: "users",
        data: { email, password },
      })

      return {
        ...doc,
        token,
        user,
      }
    }
  }

  return doc
}
