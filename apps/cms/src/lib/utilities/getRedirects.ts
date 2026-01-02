import configPromise from '@reveal-config'
import { getRevealUI } from '@revealui/cms'
import { unstable_cache } from 'next/cache'
import type { Redirect } from '@/types'

export async function getRedirects(depth = 1): Promise<Redirect[]> {
  const revealui = await getRevealUI({ config: configPromise })

  const { docs: redirects } = await revealui.find({
    collection: 'redirects',
    depth,
    limit: 0,
    pagination: false,
  })

  return redirects as unknown as Redirect[]
}

/**
 * Returns a unstable_cache function mapped with the cache tag for 'redirects'.
 *
 * Cache all redirects together to avoid multiple fetches.
 */
export const getCachedRedirects = () =>
  unstable_cache(async () => getRedirects(), ["redirects"], {
    tags: ["redirects"],
  });
