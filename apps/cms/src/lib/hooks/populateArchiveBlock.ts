import type { RevealRequest, RevealUIInstance } from '@revealui/core'
import type { Page } from '@/types'

type ArchiveBlockProps = Extract<Page['layout'][0], { blockType: 'archive' }>

interface RequestWithRevealUI extends RevealRequest {
  revealui?: RevealUIInstance
}

interface PopulateContext {
  isPopulatingArchiveBlock?: boolean
  [key: string]: unknown
}

export async function populateArchiveBlock({
  doc,
  context,
  req,
}: {
  doc: Record<string, unknown>
  context?: PopulateContext
  req: RequestWithRevealUI
}): Promise<Record<string, unknown>> {
  const revealui = req?.revealui
  const docWithLayout = doc as { layout?: Array<{ blockType: string; [key: string]: unknown }> }

  if (!docWithLayout.layout || !revealui) return doc

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

        if (archiveBlock.populateBy === 'collection' && !context?.isPopulatingArchiveBlock) {
          const res = await revealui.find({
            collection: archiveBlock?.relationTo || 'products',
            limit: archiveBlock.limit || 10,
            context: { isPopulatingArchiveBlock: true },
            where: {
              ...(archiveBlock?.categories?.length
                ? {
                    categories: {
                      in: archiveBlock.categories.map((cat) =>
                        typeof cat === 'object' ? cat.id : cat,
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
            populatedDocs: res.docs.map((thisDoc) => ({
              relationTo: archiveBlock.relationTo,
              value: String(thisDoc.id),
            })),
          }
        }
      }

      return block
    }),
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
// import type { CollectionAfterReadHook } from "@revealui/core";

// type Props = Extract<Page["layout"][0], { blockType: "archive" }>;

// export const populateArchiveBlock: CollectionAfterReadHook = async ({
//   doc,
//   context,
//   req: { revealui },
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
//           const res = await revealui.find({
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
//         const res = await revealui.find({
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
