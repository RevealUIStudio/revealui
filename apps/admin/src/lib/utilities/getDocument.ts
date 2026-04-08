import type { RevealDocument } from '@revealui/core';
import { unstable_cache } from 'next/cache';
import { getRevealUIInstance } from './revealui-singleton';

type Collection = string;

async function getDocument(
  collection: Collection,
  slug: string,
  depth = 0,
): Promise<RevealDocument | undefined> {
  const revealui = await getRevealUIInstance();

  const page = await revealui.find({
    collection,
    depth,
    where: {
      slug: {
        equals: slug,
      },
    },
  });

  return page.docs[0];
}

/**
 * Returns a cached function mapped with the cache tag for the slug
 */
export const getCachedDocument = (
  collection: Collection,
  slug: string,
): (() => Promise<RevealDocument | undefined>) =>
  unstable_cache(
    async (): Promise<RevealDocument | undefined> => getDocument(collection, slug),
    [String(collection), slug],
    {
      tags: [`${String(collection)}_${slug}`],
    },
  );
