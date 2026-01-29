import type { CollectionConfig } from '@revealui/core'
import { Banner } from '@/lib/blocks/Banner/config'
import { Code } from '@/lib/blocks/Code/config'
import { authenticated } from '../../access/index.js'
import { authenticatedOrPublished } from '../../access/roles/authenticatedOrPublished.js'
import { ArchiveBlock } from '../../blocks/ArchiveBlock/config.js'
import { CallToAction } from '../../blocks/CallToAction/config.js'
import { Content } from '../../blocks/Content/config.js'
import { FormBlock } from '../../blocks/Form/config.js'
import { MediaBlock } from '../../blocks/MediaBlock/config.js'
import { slugField } from '../../fields/slug/index.js'
import { hero } from '../../heros/config.js'
import { populatePublishedAt } from '../../hooks/populatePublishedAt.js'
import { generatePreviewPath } from '../../utilities/generatePreviewPath.js'
import { revalidatePage } from './hooks/revalidatePage.js'
export const Pages: CollectionConfig = {
  slug: 'pages',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      url: ({ data }: { data: Record<string, unknown> }) => {
        const path = generatePreviewPath({
          path: `/${typeof data?.slug === 'string' ? data.slug : ''}`,
        })
        return `${process.env.NEXT_PUBLIC_SERVER_URL}${path}`
      },
    },
    preview: (doc: Record<string, unknown>) =>
      generatePreviewPath({
        path: `/${typeof doc?.slug === 'string' ? doc.slug : ''}`,
      }),
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [hero],
          label: 'Hero',
        },
        {
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              blocks: [CallToAction, Content, MediaBlock, ArchiveBlock, FormBlock, Code, Banner],
              required: true,
            },
          ],
          label: 'Content',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            {
              name: 'image',
              type: 'relationship',
              relationTo: 'media', // Ensure this points to your media collection
            },
            {
              name: 'title',
              type: 'text',
            },
            {
              name: 'description',
              type: 'textarea',
            },
          ],
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
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
}

// import type { CollectionConfig } from "@revealui/core";
// import { ArchiveBlock } from "../../blocks/ArchiveBlock/config.js";
// import { CallToAction } from "../../blocks/CallToAction/config.js";
// import { Content } from "../../blocks/Content/config.js";
// import { FormBlock } from "../../blocks/Form/config.js";
// import { MediaBlock } from "../../blocks/MediaBlock/config.js";
// import { populatePublishedAt } from "../../hooks/populatePublishedAt.js";
// import { generatePreviewPath } from "../../utilities/generatePreviewPath.js";
// import { revalidatePage } from "./hooks/revalidatePage.js";
// import { Code } from "@/blocks/Code/config";
// import { authenticated } from "../../access/index.js";
// import { authenticatedOrPublished } from "../../access/roles/authenticatedOrPublished.js";
// import { slugField } from "../../fields/slug/index.js";
// import { hero } from "../../heros/config.js";

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
// import type { CollectionConfig } from "@revealui/core";

// import { ArchiveBlock } from "../../blocks/ArchiveBlock/config.js";
// import { CallToAction } from "../../blocks/CallToAction/config.js";
// import { Content } from "../../blocks/Content/config.js";
// import { FormBlock } from "../../blocks/Form/config.js";
// import { MediaBlock } from "../../blocks/MediaBlock/config.js";
// import { populatePublishedAt } from "../../hooks/populatePublishedAt.js";
// import { generatePreviewPath } from "../../utilities/generatePreviewPath.js";
// import { revalidatePage } from "./hooks/revalidatePage.js";
// // import { BannerBlock } from "@/blocks/Banner/Component";
// import { Code } from "@/blocks/Code/config";
// import { authenticated } from "../../access/index.js";
// import { authenticatedOrPublished } from "../../access/roles/authenticatedOrPublished.js";
// import { slugField } from "../../fields/slug/index.js";
// import { hero } from "../../heros/config.js";

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
