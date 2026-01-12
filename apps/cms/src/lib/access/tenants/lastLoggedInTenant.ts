// import type { Access } from "@revealui/core";
import type { RevealRequest } from '@revealui/core'

export const lastLoggedInTenant = (req: RevealRequest): string | null => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = req?.user as any

  // Check if lastLoggedInTenant is a number (tenant ID) or a Tenant object with an id
  const lastTenant = user?.lastLoggedInTenant

  if (typeof lastTenant === 'string') {
    return lastTenant
  } else if (typeof lastTenant === 'number') {
    // If it's a number, return it as a string
    return lastTenant.toString()
  } else if (lastTenant && typeof lastTenant === 'object' && 'id' in lastTenant) {
    // If it's a Tenant object, return the id as a string (convert to string just in case)
    return String(lastTenant.id) // This ensures that both numbers and strings are safely returned as strings
  }

  // If no valid tenant is found, return null
  return null
}
