import type { CollectionConfig } from "@revealui/cms";
import { ArchiveBlock } from "../../blocks/ArchiveBlock/config";
import { CallToAction } from "../../blocks/CallToAction/config";
import { Content } from "../../blocks/Content/config";
import { FormBlock } from "../../blocks/Form/config";
import { MediaBlock } from "../../blocks/MediaBlock/config";
import { populatePublishedAt } from "../../hooks/populatePublishedAt";
import { generatePreviewPath } from "../../utilities/generatePreviewPath";
import { revalidatePage } from "./hooks/revalidatePage";
import { Code } from "@/lib/blocks/Code/config";
import { authenticated } from "../../access";
import { authenticatedOrPublished } from "../../access/roles/authenticatedOrPublished";
import { slugField } from "../../fields/slug";
import { hero } from "../../heros/config";
import { Banner } from "@/lib/blocks/Banner/config";
export const Pages: CollectionConfig = {
  slug: "pages",
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  admin: {
    defaultColumns: ["title", "slug", "updatedAt"],
    livePreview: {
      url: ({ data }) => {
        const path = generatePreviewPath({
          path: `/${typeof data?.slug === "string" ? data.slug : ""}`,
        });
        return `${process.env.NEXT_PUBLIC_SERVER_URL}${path}`;
      },
    },
    preview: (doc) =>
      generatePreviewPath({
        path: `/${typeof doc?.slug === "string" ? doc.slug : ""}`,
      }),
    useAsTitle: "title",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      type: "tabs",
      tabs: [
        {
          fields: [hero],
          label: "Hero",
        },
        {
          fields: [
            {
              name: "layout",
              type: "blocks",
              blocks: [
                CallToAction,
                Content,
                MediaBlock,
                ArchiveBlock,
                FormBlock,
                Code,
                Banner,
              ],
              required: true,
            },
          ],
          label: "Content",
        },
        {
          name: "meta",
          label: "SEO",
          fields: [
            {
              name: "image",
              type: "relationship",
              relationTo: "media", // Ensure this points to your media collection
            },
            {
              name: "title",
              type: "text",
            },
            {
              name: "description",
              type: "textarea",
            },
          ],
        },
      ],
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        position: "sidebar",
      },
    },
    ...slugField(),
  ],
  hooks: {
    afterChange: [revalidatePage],
    beforeChange: [populatePublishedAt],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100, // Optimal live preview interval
      },
    },
    maxPerDoc: 50,
  },
};

// import type { CollectionConfig } from "@revealui/cms";
// import { ArchiveBlock } from "../../blocks/ArchiveBlock/config";
// import { CallToAction } from "../../blocks/CallToAction/config";
// import { Content } from "../../blocks/Content/config";
// import { FormBlock } from "../../blocks/Form/config";
// import { MediaBlock } from "../../blocks/MediaBlock/config";
// import { populatePublishedAt } from "../../hooks/populatePublishedAt";
// import { generatePreviewPath } from "../../utilities/generatePreviewPath";
// import { revalidatePage } from "./hooks/revalidatePage";
// import { Code } from "@/blocks/Code/config";
// import { authenticated } from "../../access";
// import { authenticatedOrPublished } from "../../access/roles/authenticatedOrPublished";
// import { slugField } from "../../fields/slug";
// import { hero } from "../../heros/config";

// export const Pages: CollectionConfig = {
//   slug: "pages",
//   access: {
//     create: authenticated,
//     delete: authenticated,
//     read: authenticatedOrPublished,
//     update: authenticated,
//   },
//   admin: {
//     defaultColumns: ["title", "slug", "updatedAt"],
//     livePreview: {
//       url: ({ data }) => {
//         const path = generatePreviewPath({
//           path: `/${typeof data?.slug === "string" ? data.slug : ""}`,
//         });
//         return `${process.env.NEXT_PUBLIC_SERVER_URL}${path}`;
//       },
//     },
//     preview: (doc) =>
//       generatePreviewPath({
//         path: `/${typeof doc?.slug === "string" ? doc.slug : ""}`,
//       }),
//     useAsTitle: "title",
//   },
//   fields: [
//     {
//       name: "title",
//       type: "text",
//       required: true,
//     },
//     {
//       type: "tabs",
//       tabs: [
//         {
//           fields: [hero],
//           label: "Hero",
//         },
//         {
//           fields: [
//             {
//               name: "layout",
//               type: "blocks",
//               blocks: [
//                 CallToAction,
//                 Content,
//                 MediaBlock,
//                 ArchiveBlock,
//                 FormBlock,
//                 Code,
//               ],
//               required: true,
//             },
//           ],
//           label: "Content",
//         },
//         {
//           name: "meta",
//           label: "SEO",
//           fields: [
//             {
//               name: "image", // Image field for SEO
//               type: "relationship",
//               relationTo: "media", // Ensure this points to your media collection
//             },
//             {
//               name: "title", // SEO Title
//               type: "text",
//             },
//             {
//               name: "description", // SEO Description
//               type: "textarea",
//             },
//           ],
//         },
//       ],
//     },
//     {
//       name: "publishedAt",
//       type: "date",
//       admin: {
//         position: "sidebar",
//       },
//     },
//     ...slugField(),
//   ],
//   hooks: {
//     afterChange: [revalidatePage],
//     beforeChange: [populatePublishedAt],
//   },
//   versions: {
//     drafts: {
//       autosave: {
//         interval: 100, // Optimal live preview interval
//       },
//     },
//     maxPerDoc: 50,
//   },
// };

// /* eslint-disable @typescript-eslint/no-explicit-any */
// import type { CollectionConfig } from "@revealui/cms";

// import { ArchiveBlock } from "../../blocks/ArchiveBlock/config";
// import { CallToAction } from "../../blocks/CallToAction/config";
// import { Content } from "../../blocks/Content/config";
// import { FormBlock } from "../../blocks/Form/config";
// import { MediaBlock } from "../../blocks/MediaBlock/config";
// import { populatePublishedAt } from "../../hooks/populatePublishedAt";
// import { generatePreviewPath } from "../../utilities/generatePreviewPath";
// import { revalidatePage } from "./hooks/revalidatePage";
// // import { BannerBlock } from "@/blocks/Banner/Component";
// import { Code } from "@/blocks/Code/config";
// import { authenticated } from "../../access";
// import { authenticatedOrPublished } from "../../access/roles/authenticatedOrPublished";
// import { slugField } from "../../fields/slug";
// import { hero } from "../../heros/config";

// export const Pages: CollectionConfig = {
//   slug: "pages",
//   access: {
//     create: authenticated,
//     delete: authenticated,
//     read: authenticatedOrPublished,
//     update: authenticated,
//   },
//   admin: {
//     defaultColumns: ["title", "slug", "updatedAt"],
//     livePreview: {
//       url: ({ data }) => {
//         const path = generatePreviewPath({
//           path: `/${typeof data?.slug === "string" ? data.slug : ""}`,
//         });
//         return `${process.env.NEXT_PUBLIC_SERVER_URL}${path}`;
//       },
//     },
//     preview: (doc) =>
//       generatePreviewPath({
//         path: `/${typeof doc?.slug === "string" ? doc.slug : ""}`,
//       }),
//     useAsTitle: "title",
//   },
//   fields: [
//     {
//       name: "title",
//       type: "text",
//       required: true,
//     },
//     {
//       type: "tabs",
//       tabs: [
//         {
//           fields: [hero],
//           label: "Hero",
//         },
//         {
//           fields: [
//             {
//               name: "layout",
//               type: "blocks",
//               blocks: [
//                 CallToAction,
//                 Content,
//                 MediaBlock,
//                 ArchiveBlock,
//                 FormBlock,
//                 // BannerBlock,
//                 Code,
//               ],
//               required: true,
//             },
//           ],
//           label: "Content",
//         },
//         {
//           name: "meta",
//           label: "SEO",
//           fields: [],
//         },
//       ],
//     },
//     {
//       name: "publishedAt",
//       type: "date",
//       admin: {
//         position: "sidebar",
//       },
//     },
//     ...slugField(),
//   ],
//   hooks: {
//     afterChange: [revalidatePage],
//     beforeChange: [populatePublishedAt],
//   },
//   versions: {
//     drafts: {
//       autosave: {
//         interval: 100, // We set this interval for optimal live preview
//       },
//     },
//     maxPerDoc: 50,
//   },
// };
