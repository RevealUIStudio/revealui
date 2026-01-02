/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PayloadHandler, PayloadRequest } from '@revealui/cms'

// Extend User type to include userID
interface UserWithID {
  userID: string
}

export const tenantProxy: PayloadHandler = async (req: PayloadRequest): Promise<Response> => {
  const logs = req?.payload?.logger?.info
  const userID = req.query?.userID as string | undefined

  if (!req.user) {
    const message = 'No user found'
    logs?.(message)
    return new Response(message, { status: 401 })
  }

  // Cast user to UserWithID to include userID property
  const userWithID = req.user as typeof req.user & UserWithID

  if (!userWithID.userID) {
    const message = `No ID found for user ${userID}`
    logs?.(message)
    return new Response(message, { status: 400 })
  }

  if (userWithID.userID !== userID) {
    const message = `User ID ${userWithID.userID} does not match ${userID}`
    logs?.(message)
    return new Response(message, { status: 403 })
  }

  return new Response(null, { status: 200 })
}
