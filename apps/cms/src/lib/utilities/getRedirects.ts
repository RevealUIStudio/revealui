import type { Redirect } from '@revealui/core/types/cms';
import { unstable_cache } from 'next/cache';
import { getRevealUIInstance } from './revealui-singleton';

export async function getRedirects(depth = 1): Promise<Redirect[]> {
  const revealui = await getRevealUIInstance();

  const { docs: redirects } = await revealui.find({
    collection: 'redirects',
    depth,
    limit: 0,
    pagination: false,
  });

  return redirects as unknown as Redirect[];
}

/**
 * Returns a unstable_cache function mapped with the cache tag for 'redirects'.
 *
 * Cache all redirects together to avoid multiple fetches.
 */
export function getCachedRedirects() {
  return unstable_cache(async () => getRedirects(), ['redirects'], {
    tags: ['redirects'],
  });
}
