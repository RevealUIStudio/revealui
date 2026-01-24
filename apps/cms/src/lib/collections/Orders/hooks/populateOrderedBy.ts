import type { RevealRequest } from '@revealui/core'

// Field hook for populating orderedBy with current user ID
export const populateOrderedBy = async ({
  req,
  operation,
  value,
}: {
  req?: RevealRequest
  operation?: string
  value?: string | number | null
}): Promise<string | number | null | undefined> => {
  if ((operation === 'create' || operation === 'update') && !value) {
    return req?.user?.id
  }

  return value
}
