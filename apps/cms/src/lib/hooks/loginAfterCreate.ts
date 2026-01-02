interface RevealUIWithLogin {
  login: (args: { collection: string; data: { email: string; password: string } }) => Promise<{ user: unknown; token: string }>
}

export const loginAfterCreate = async ({ doc, req, operation }: {
  doc: Record<string, unknown>
  req: { user?: unknown; revealui?: RevealUIWithLogin; data?: { password?: string } }
  operation: string
}) => {
  if (operation === 'create' && !req.user && req.revealui) {
    const revealui = req.revealui

    // In RevealUI CMS 3.x, access body data from the doc itself
    const email = doc.email as string | undefined
    const password = req.data?.password as string | undefined

    if (email && password) {
      const { user, token } = await revealui.login({
        collection: 'users',
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
