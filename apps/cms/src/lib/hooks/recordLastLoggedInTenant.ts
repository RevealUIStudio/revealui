/* eslint-disable @typescript-eslint/no-explicit-any */
export const recordLastLoggedInTenant = async ({ req, user }: { req: any; user: any }) => {
  try {
    const relatedOrg = await req.revealui
      .find({
        collection: 'tenants',
        where: {
          'domains.domain': {
            in: [req.headers.host],
          },
        },
        depth: 0,
        limit: 1,
      })
      ?.then((res: { docs: any[] }) => res.docs?.[0])

    await req.revealui.update({
      id: user.id,
      collection: ['users'],
      data: {
        lastLoggedInTenant: relatedOrg?.id || null,
      },
      req,
    })
  } catch (err: unknown) {
    req?.revealui?.logger.error(`Error recording last logged in tenant for user ${user.id}: ${err}`)
  }

  return user
}
