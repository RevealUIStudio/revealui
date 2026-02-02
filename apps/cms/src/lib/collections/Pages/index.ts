import type { CollectionConfig } from '@revealui/core'
import { Banner } from '@/lib/blocks/Banner/config'
import { Code } from '@/lib/blocks/Code/config'
import { authenticated } from '@/lib/access'
import { authenticatedOrPublished } from '@/lib/access/roles/authenticatedOrPublished'
import { ArchiveBlock } from '@/lib/blocks/ArchiveBlock/config'
import { CallToAction } from '@/lib/blocks/CallToAction/config'
import { Content } from '@/lib/blocks/Content/config'
import { FormBlock } from '@/lib/blocks/Form/config'
import { MediaBlock } from '@/lib/blocks/MediaBlock/config'
import { slugField } from '@/lib/fields/slug/index'
import { hero } from '@/lib/heros/config'
import { populatePublishedAt } from '@/lib/hooks/populatePublishedAt'
import { generatePreviewPath } from '@/lib/utilities/generatePreviewPath'
import { revalidatePage } from './hooks/revalidatePage'
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
    // biome-ignore lint/suspicious/noExplicitAny: RevealUI CMS hook type compatibility
    afterChange: [revalidatePage as any],
    // biome-ignore lint/suspicious/noExplicitAny: RevealUI CMS hook type compatibility
    beforeChange: [populatePublishedAt as any],
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
// import { ArchiveBlock } from '@/lib/blocks/ArchiveBlock/config';
// import { CallToAction } from '@/lib/blocks/CallToAction/config';
// import { Content } from '@/lib/blocks/Content/config';
// import { FormBlock } from '@/lib/blocks/Form/config';
// import { MediaBlock } from '@/lib/blocks/MediaBlock/config';
// import { populatePublishedAt } from '@/lib/hooks/populatePublishedAt';
// import { generatePreviewPath } from '@/lib/utilities/generatePreviewPath';
// import { revalidatePage } from "./hooks/revalidatePage.js";
// import { Code } from "@/blocks/Code/config";
// import { authenticated } from '@/lib/access/index';
// import { authenticatedOrPublished } from '@/lib/access/roles/authenticatedOrPublished';
// import { slugField } from '@/lib/fields/slug/index';
// import { hero } from '@/lib/heros/config';

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

// import { ArchiveBlock } from '@/lib/blocks/ArchiveBlock/config';
// import { CallToAction } from '@/lib/blocks/CallToAction/config';
// import { Content } from '@/lib/blocks/Content/config';
// import { FormBlock } from '@/lib/blocks/Form/config';
// import { MediaBlock } from '@/lib/blocks/MediaBlock/config';
// import { populatePublishedAt } from '@/lib/hooks/populatePublishedAt';
// import { generatePreviewPath } from '@/lib/utilities/generatePreviewPath';
// import { revalidatePage } from "./hooks/revalidatePage.js";
// // import { BannerBlock } from "@/blocks/Banner/Component";
// import { Code } from "@/blocks/Code/config";
// import { authenticated } from '@/lib/access/index';
// import { authenticatedOrPublished } from '@/lib/access/roles/authenticatedOrPublished';
// import { slugField } from '@/lib/fields/slug/index';
// import { hero } from '@/lib/heros/config';

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
