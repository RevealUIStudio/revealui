import { createCachedFunction } from '@revealui/cache';
import type { Redirect } from '@revealui/core/types/admin';
import { getRevealUIInstance } from '@/lib/utils/revealui-singleton';
import { asDocuments } from '@/lib/utils/type-guards';

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
 * Returns a cached function mapped with the cache tag for 'redirects'.
 * Cache all redirects together to avoid multiple fetches.
 * (GAP-194 3.7a: @revealui/cache)
 */
export function getCachedRedirects() {
  return createCachedFunction(async () => getRedirects(), {
    keyParts: ['redirects'],
    tags: ['redirects'],
  });
}
