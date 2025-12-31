import configPromise from "@payload-config";
import { getPayloadHMR } from "@payloadcms/next/utilities";
import React from "react";
import { CollectionArchive } from "../../components/CollectionArchive";
import RichText from "../../components/RichText";
import { Category, Post } from "@/types";

export interface ArchiveBlockProps {
  introContent?: {
    root: {
      type: string;
      children: {
        type: string;
        version: number;
        [k: string]: unknown;
      }[];
      direction: ("ltr" | "rtl") | null;
      format: "left" | "start" | "center" | "right" | "end" | "justify" | "";
      indent: number;
      version: number;
    };
    [k: string]: unknown;
  } | null;
  populateBy?: "collection" | "selection" | null;
  relationTo?: "posts" | null;
  categories?: (string | Category)[] | null;
  limit?: number | null;
  selectedDocs?:
    | {
        relationTo: "posts";
        value: string | Post;
      }[]
    | null;
  id?: string | null;
  blockName?: string | null;
  blockType: "archive";
}

export const ArchiveBlock: React.FC<ArchiveBlockProps> = async (props) => {
  const {
    id,
    categories,
    introContent,
    limit: limitFromProps,
    populateBy,
    selectedDocs,
  } = props;
  const limit = limitFromProps || 3;

  let posts: Post[] = [];

  if (populateBy === "collection") {
    const payload = await getPayloadHMR({ config: configPromise });

    const flattenedCategories = categories?.map((category) =>
      typeof category === "object" ? category.id : category,
    );

    const fetchedPosts = await payload.find({
      collection: "posts",
      depth: 1,
      limit,
      ...(flattenedCategories && flattenedCategories.length > 0
        ? {
            where: {
              categories: {
                in: flattenedCategories,
              },
            },
          }
        : {}),
    });

    posts = fetchedPosts.docs;
  } else if (selectedDocs?.length) {
    posts = selectedDocs
      .map((doc) => (typeof doc.value === "object" ? doc.value : null))
      .filter(Boolean) as Post[];
  }

  return (
    <div className="my-16" id={`block-${id}`}>
      {introContent && (
        <div className="container mb-16">
          <RichText
            className="ml-0 max-w-3xl"
            content={introContent}
            enableGutter={false}
          />
        </div>
      )}
      <CollectionArchive posts={posts} />
    </div>
  );
};

// /* eslint-disable @typescript-eslint/no-explicit-any */
// import configPromise from "@payload-config";
// import { getPayloadHMR } from "@payloadcms/next/utilities";
// import React from "react";
// import { CollectionArchive } from "../../components/CollectionArchive";
// import RichText from "../../components/RichText";
// import { Category, Post } from "@/types";

// export interface ArchiveBlockProps {
//   introContent?: {
//     root: {
//       type: string;
//       children: {
//         type: string;
//         version: number;
//         [k: string]: unknown;
//       }[];
//       direction: ("ltr" | "rtl") | null;
//       format: "left" | "start" | "center" | "right" | "end" | "justify" | "";
//       indent: number;
//       version: number;
//     };
//     [k: string]: unknown;
//   } | null;
//   populateBy?: ("collection" | "selection") | null;
//   relationTo?: "posts" | null;
//   categories?: (string | Category)[] | null;
//   limit?: number | null;
//   selectedDocs?:
//     | {
//         relationTo: "posts";
//         value: string | Post;
//       }[]
//     | null;
//   id?: string | null;
//   blockName?: string | null;
//   blockType: "archive";
// }

// export const ArchiveBlock: React.FC<ArchiveBlockProps> = async (props) => {
//   const {
//     id,
//     categories,
//     introContent,
//     limit: limitFromProps,
//     populateBy,
//     selectedDocs,
//   } = props;

//   const limit = limitFromProps || 3;

//   let posts: Post[] = [];

//   if (populateBy === "collection") {
//     const payload = await getPayloadHMR({ config: configPromise });

//     const flattenedCategories = categories?.map((category) => {
//       if (typeof category === "object") {
//         return category.id; // Access id from Category
//       } else {
//         return category; // Return the string directly
//       }
//     });

//     const fetchedPosts = await payload.find({
//       collection: "posts",
//       depth: 1,
//       limit,
//       ...(flattenedCategories && flattenedCategories.length > 0
//         ? {
//             where: {
//               categories: {
//                 in: flattenedCategories,
//               },
//             },
//           }
//         : {}),
//     });

//     posts = fetchedPosts.docs; // Use fetched posts directly
//   } else {
//     if (selectedDocs?.length) {
//       posts = selectedDocs.map((post) => {
//         if (typeof post.value === "object") {
//           return post.value; // Directly return Post object
//         }
//       }) as Post[];
//     }
//   }

//   return (
//     <div className="my-16" id={`block-${id}`}>
//       {introContent && (
//         <div className="container mb-16">
//           <RichText
//             className="ml-0 max-w-3xl"
//             content={introContent}
//             enableGutter={false}
//           />
//         </div>
//       )}
//       <CollectionArchive posts={posts} />
//     </div>
//   );
// };

// // export const ArchiveBlock: React.FC<ArchiveBlockProps> = async (props) => {
// //   const {
// //     id,
// //     categories,
// //     introContent,
// //     limit: limitFromProps,
// //     populateBy,
// //     selectedDocs,
// //   } = props;

// //   const limit = limitFromProps || 3;

// //   let posts: Post[] = [];

// //   if (populateBy === "collection") {
// //     const payload = await getPayloadHMR({ config: configPromise });

// //     const flattenedCategories = categories?.map((category) => {
// //       if (typeof category === "object") return category.id;
// //       else return category;
// //     });

// //     const fetchedPosts = await payload.find({
// //       collection: "posts",
// //       depth: 1,
// //       limit,
// //       ...(flattenedCategories && flattenedCategories.length > 0
// //         ? {
// //             where: {
// //               categories: {
// //                 in: flattenedCategories,
// //               },
// //             },
// //           }
// //         : {}),
// //     });

// //     let posts = fetchedPosts.docs;
// //     // eslint-disable-next-line @typescript-eslint/no-unused-vars
// //     posts = posts.map(id as any);
// //   } else {
// //     if (selectedDocs?.length) {
// //       const filteredSelectedPosts = selectedDocs.map((post) => {
// //         if (typeof post.value === "object") return post.value;
// //       }) as Post[];

// //       posts = filteredSelectedPosts;
// //     }
// //   }

// //   return (
// //     <div className="my-16" id={`block-${id}`}>
// //       {introContent && (
// //         <div className="container mb-16">
// //           <RichText
// //             className="ml-0 max-w-3xl"
// //             content={introContent}
// //             enableGutter={false}
// //           />
// //         </div>
// //       )}
// //       <CollectionArchive posts={posts} />
// //     </div>
// //   );
// // };
