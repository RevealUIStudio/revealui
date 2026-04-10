import type { RevealDocument } from '@revealui/core';
import { logger } from '@revealui/utils/logger';
import { unstable_cache } from 'next/cache';
import { getRevealUIInstance } from './revealui-singleton';

type Global = string;

async function getGlobal(slug: Global, depth = 0): Promise<RevealDocument | null> {
  try {
    const revealui = await getRevealUIInstance();

    // Check if findGlobal exists and is a function
    if (typeof revealui.findGlobal !== 'function') {
      logger.warn('findGlobal method is not available on RevealUI instance');
      return null;
    }

    const global = await revealui.findGlobal({
      slug,
      depth,
    });

    return global;
  } catch (error) {
    // Return null if instance init or global fetch fails
    // This allows the app to render without the global data
    logger.warn(`Global '${slug}' not found or admin instance failed to initialize`, {
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedGlobal = (slug: Global, depth = 0) =>
  unstable_cache(async () => getGlobal(slug, depth), [String(slug)], {
    tags: [`global_${String(slug)}`],
  });
