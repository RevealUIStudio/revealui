import configPromise from "@reveal-config";
import { getRevealUI } from "@revealui/cms/nextjs";
import { unstable_cache } from "next/cache";
import type { Config } from "@revealui/cms";

type Global = keyof Config["globals"];

async function getGlobal(slug: Global, depth = 0) {
  const payload = await getRevealUI({ config: configPromise });

  const global = await payload.findGlobal({
    slug,
    depth,
  });

  return global;
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedGlobal = (slug: Global, depth = 0) =>
  unstable_cache(async () => getGlobal(slug, depth), [slug], {
    tags: [`global_${slug}`],
  });
