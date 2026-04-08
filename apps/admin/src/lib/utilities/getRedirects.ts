import type { Redirect } from '@revealui/core/types/cms';
import { unstable_cache } from 'next/cache';
import { asDocuments } from '@/lib/utils/type-guards';
import { getRevealUIInstance } from './revealui-singleton';

export async function getRedirects(depth = 1): Promise<Redirect[]> {
  const revealui = await getRevealUIInstance();

  const { docs: redirects } = await revealui.find({
    collection: 'redirects',
    depth,
    limit: 0,
    pagination: false,
  });

  return asDocuments<Redirect>(redirects as unknown[]);
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
