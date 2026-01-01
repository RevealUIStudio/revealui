import { Page } from "@/types";
import type { CollectionAfterReadHook } from "@revealui/cms";

type ArchiveBlockProps = Extract<Page["layout"][0], { blockType: "archive" }>;

export const populateArchiveBlock: CollectionAfterReadHook = async ({
  doc,
  context,
  req: { payload },
}) => {
  const layoutWithArchive = await Promise.allSettled(
    doc.layout.map(async (block: { blockType: string }) => {
      if (block.blockType === "archive") {
        const archiveBlock = block as ArchiveBlockProps & {
          populatedDocs: Array<{
            relationTo: "products" | "pages" | "posts" | "categories";
            value: string;
          }>;
        };

        if (
          archiveBlock.populateBy === "collection" &&
          !context.isPopulatingArchiveBlock
        ) {
          const res = await payload.find({
            collection: archiveBlock?.relationTo || "products",
            limit: archiveBlock.limit || 10,
            context: { isPopulatingArchiveBlock: true },
            where: {
              ...(archiveBlock?.categories?.length
                ? {
                    categories: {
                      in: archiveBlock.categories.map((cat) =>
                        typeof cat === "object" ? cat.id : cat,
                      ),
                    },
                  }
                : {}),
            },
            sort: "-publishedOn",
          });

          return {
            ...block,
            populatedDocsTotal: res.totalDocs,
            populatedDocs: res.docs.map((thisDoc) => ({
              relationTo: archiveBlock.relationTo,
              value: thisDoc.id,
            })),
          };
        }
      }

      return block;
    }),
  );

  return { ...doc, layout: layoutWithArchive };
};

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
//                         })
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
//                       })
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
