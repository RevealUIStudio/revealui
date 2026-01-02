/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Page } from '@/types'

type ArchiveBlockProps = Extract<Page['layout'][0], { blockType: 'archive' }>

interface PayloadWithFind {
  find: (args: {
    collection: string
    limit?: number
    context?: Record<string, unknown>
    where?: Record<string, unknown>
    sort?: string
  }) => Promise<{ docs: Array<{ id: string }>; totalDocs: number }>
}

export const populateArchiveBlock = async ({
  doc,
  context,
  req,
}: {
  doc: Record<string, unknown>
  context?: Record<string, unknown>
  req: { payload?: PayloadWithFind }
}) => {
  const payload = req?.payload as PayloadWithFind | undefined
  const docWithLayout = doc as { layout?: Array<{ blockType: string; [key: string]: unknown }> }

  if (!docWithLayout.layout || !payload) return doc

  const layout = docWithLayout.layout

  const layoutWithArchive = await Promise.allSettled(
    layout.map(async (block) => {
      if (block.blockType === 'archive') {
        const archiveBlock = block as unknown as ArchiveBlockProps & {
          populatedDocs: Array<{
            relationTo: 'products' | 'pages' | 'posts' | 'categories'
            value: string
          }>
        }

        if (
          archiveBlock.populateBy === 'collection' &&
          !(context as any)?.isPopulatingArchiveBlock
        ) {
          const res = await payload.find({
            collection: archiveBlock?.relationTo || 'products',
            limit: archiveBlock.limit || 10,
            context: { isPopulatingArchiveBlock: true },
            where: {
              ...(archiveBlock?.categories?.length
                ? {
                    categories: {
                      in: archiveBlock.categories.map((cat) =>
                        typeof cat === 'object' ? cat.id : cat
                      ),
                    },
                  }
                : {}),
            },
            sort: '-publishedOn',
          })

          return {
            ...block,
            populatedDocsTotal: res.totalDocs,
            populatedDocs: res.docs.map((thisDoc: { id: string }) => ({
              relationTo: archiveBlock.relationTo,
              value: thisDoc.id,
            })),
          }
        }
      }

      return block
    })
  )

  // Extract fulfilled values from the settled promises
  const resolvedLayout = layoutWithArchive
    .map((result) => {
      if (result.status === 'fulfilled') {
        return result.value
      }
      // For rejected promises, return the original block
      return null
    })
    .filter(Boolean)

  return { ...doc, layout: resolvedLayout }
}

// /* eslint-disable @typescript-eslint/no-explicit-any */

// import { Page } from "@/types";
// import type { CollectionAfterReadHook } from "@revealui/cms";

// type Props = Extract<Page["layout"][0], { blockType: "archive" }>;

// export const populateArchiveBlock: CollectionAfterReadHook = async ({
//   doc,
//   context,
//   req: { payload },
// }) => {
//   // pre-populate the archive block if `populateBy` is `collection`
//   // then hydrate it on your front-end

//   const layoutWithArchive = await Promise.allSettled(
//     doc.layout.map(async (block: { blockType: string }) => {
//       if (block.blockType === "archive") {
//         const archiveBlock = block as Extract<
//           Props,
//           { blockType: "archive" }
//         > & {
//           populatedDocs: Array<{
//             relationTo: "products" | "pages" | "posts" | "categories";
//             value: string;
//           }>;
//         };

//         if (
//           archiveBlock.populateBy === "collection" &&
//           !context.isPopulatingArchiveBlock
//         ) {
//           const res = await payload.find({
//             collection: archiveBlock?.relationTo || "products",
//             limit: archiveBlock.limit || 10,
//             context: {
//               isPopulatingArchiveBlock: true,
//             },
//             where: {
//               ...((archiveBlock?.categories?.length || 0) > 0
//                 ? {
//                     categories: {
//                       in: archiveBlock?.categories
//                         ?.map((cat) => {
//                           if (typeof cat === "number") {
//                             return cat; // return string directly
//                           } else if ("id" in cat) {
//                             return cat.id; // return id from Category
//                           }
//                           throw new Error("Invalid category type"); // Handle unexpected types
//                        )
//                         .join(","),
//                     },
//                   }
//                 : {}),
//             },
//             sort: "-publishedOn",
//           });

//           return {
//             ...block,
//             populatedDocsTotal: res.totalDocs,
//             populatedDocs: res.docs.map((thisDoc) => ({
//               relationTo: archiveBlock.relationTo,
//               value: thisDoc.id,
//             })),
//           };
//         }
//       }

//       return block;
//     }),
//   );

// const layoutWithArchive = await Promise.allSettled(
//   doc.layout.map(async (block: { blockType: string }) => {
//     if (block.blockType === "archive") {
//       const archiveBlock = block as Extract<
//         LayoutPage["layout"][0],
//         { blockType: "archive" }
//       > & {
//         populatedDocs: Array<{
//           relationTo: "products" | "pages" | "posts" | "categories";
//           value: string;
//         }>;
//       };

//       if (
//         archiveBlock.populateBy === "collection" &&
//         !context.isPopulatingArchiveBlock
//       ) {
//         const res = await payload.find({
//           collection: archiveBlock?.relationTo || "products",
//           limit: archiveBlock.limit || 10,
//           context: {
//             isPopulatingArchiveBlock: true,
//           },
//           where: {
//             ...((archiveBlock?.categories?.length || 0) > 0
//               ? {
//                   categories: {
//                     in: archiveBlock?.categories
//                       ?.map((cat) => {
//                         if (typeof cat === "string") return cat;
//                         return cat.id;
//                      )
//                       .join(","),
//                   },
//                 }
//               : {}),
//           },
//           sort: "-publishedOn",
//         });

//         return {
//           ...block,
//           populatedDocsTotal: res.totalDocs,
//           populatedDocs: res.docs.map((thisDoc: { id: string }) => ({
//             relationTo: archiveBlock.relationTo,
//             value: thisDoc.id,
//           })),
//         };
//       }
//     }

//     return block;
//   }),
// );

//   return {
//     ...doc,
//     layout: layoutWithArchive,
//   };
// };
