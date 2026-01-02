import configPromise from "@reveal-config";
import { getRevealUI } from "@revealui/cms/nextjs";
import { unstable_cache } from "next/cache";
import type { Config } from "@revealui/cms";

type Global = "settings" | "header" | "footer" | string;

async function getGlobal(slug: Global, depth = 0) {
  const revealui = await getRevealUI({ config: configPromise });

  if (!revealui.findGlobal) {
    throw new Error('findGlobal is not implemented');
  }

  const global = await revealui.findGlobal({
    slug: slug as string,
    depth,
  });

  return global;
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedGlobal = (slug: Global, depth = 0) =>
  unstable_cache(async () => getGlobal(slug, depth), [String(slug)], {
    tags: [`global_${String(slug)}`],
  });
