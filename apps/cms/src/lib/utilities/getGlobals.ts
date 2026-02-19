import type { RevealDocument } from '@revealui/core'
import { logger } from '@revealui/core/observability/logger'
import { unstable_cache } from 'next/cache'
import { getRevealUIInstance } from './revealui-singleton'

type Global = string

async function getGlobal(slug: Global, depth = 0): Promise<RevealDocument | null> {
  const revealui = await getRevealUIInstance()

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
    logger.warn(`Global '${slug}' not found or not yet created`, {
      slug,
      error: error instanceof Error ? error.message : String(error),
    })
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
