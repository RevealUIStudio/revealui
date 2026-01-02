import configPromise from "@reveal-config";
import { getRevealUI } from "@revealui/cms/nextjs";
import { unstable_cache } from "next/cache";
import type { Config } from "@revealui/cms";

type Collection = "pages" | "posts" | "media" | "categories" | string;

async function getDocument(collection: Collection, slug: string, depth = 0) {
  const payload = await getRevealUI({ config: configPromise });

  const page = await payload.find({
    collection: collection as string,
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
export const getCachedDocument = (collection: Collection, slug: string) =>
  unstable_cache(
    async () => getDocument(collection, slug),
    [String(collection), slug],
    {
      tags: [`${String(collection)}_${slug}`],
    },
  );

// import { unstable_cache } from "next/cache";
// import { Config } from "@revealui/cms";

// // type Collection = keyof Config["collections"];
// type Collection = Extract<keyof Config["collections"], string>;

// async function getDocument(collection: Collection, slug: string, depth = 0) {
//   const payload = await getRevealUI({ config: configPromise });

//   const page = await payload.find({
//     collection,
//     depth,
//     where: {
//       slug: {
//         equals: slug,
//       },
//     },
//   });

//   return page.docs[0];
// }

// /**
//  * Returns a unstable_cache function mapped with the cache tag for the slug
//  */
// export const getCachedDocument = (collection: Collection, slug: string) =>
//   unstable_cache(
//     async () => getDocument(collection, slug),
//     [collection, slug],
//     {
//       tags: [`${collection}_${slug}`],
//     },
//   );
