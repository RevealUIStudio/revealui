import config from '@revealui/config/revealui'
import type { RevealDocument } from '@revealui/core'
import { getRevealUI } from '@revealui/core/nextjs'
import { unstable_cache } from 'next/cache'

type Global = string

async function getGlobal(slug: Global, depth = 0): Promise<RevealDocument | null> {
  const revealui = await getRevealUI({ config })

  // Check if findGlobal exists and is a function
  if (typeof revealui.findGlobal !== 'function') {
    throw new Error('findGlobal method is not available on RevealUI instance')
  }

  try {
    const global = await revealui.findGlobal({
      slug,
      depth,
    })

    return global
  } catch (error) {
    // Return null if global doesn't exist or hasn't been created yet
    // This allows the app to render without the global data
    console.warn(`Global '${slug}' not found or not yet created:`, error)
    return null
  }
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedGlobal = (slug: Global, depth = 0) =>
  unstable_cache(async () => getGlobal(slug, depth), [String(slug)], {
    tags: [`global_${String(slug)}`],
  })
