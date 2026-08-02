import { createCachedFunction } from '@revealui/cache';
import type { RevealDocument } from '@revealui/core';
import { getRevealUIInstance } from '@/lib/utils/revealui-singleton';

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
 * (GAP-194 3.7a: @revealui/cache). Tag shape preserved: `${collection}_${slug}`.
 */
export const getCachedDocument = (
  collection: Collection,
  slug: string,
): (() => Promise<RevealDocument | undefined>) =>
  createCachedFunction(
    async (): Promise<RevealDocument | undefined> => getDocument(collection, slug),
    {
      keyParts: [String(collection), slug],
      tags: [`${String(collection)}_${slug}`],
    },
  );
