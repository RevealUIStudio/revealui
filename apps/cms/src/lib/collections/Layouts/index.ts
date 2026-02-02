// ReusableContent block not found - commenting out for now
// import { ReusableContent } from "@/lib/blocks/ReusableContent";
// import {SiteTitle} from "@/blocks/SiteTitle";
import type { Block, CollectionConfig } from '@revealui/core'

const LayoutsField = {
  title: 'title',
  name: 'name',
  slug: 'slug',
  description: 'description',
}

export type LayoutFieldKey = (typeof LayoutsField)[keyof typeof LayoutsField]

// ReusableContent block not found - using empty array for now
const blocks: Block[] = []

const Layouts: CollectionConfig = {
  slug: LayoutsField.slug,
  // slug: "layouts",
  access: {
    read: () => true,
  },
  admin: {
    // useAsTitle: LayoutsField.title,
  },
  fields: [
    {
      name: LayoutsField.name,
      type: 'text',
      required: true,
    },
    {
      name: LayoutsField.slug,
      type: 'text',
      unique: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: LayoutsField.description,
      type: 'text',
    },
    {
      name: 'header',
      type: 'group',
      fields: [
        {
          name: 'blocks',
          type: 'blocks',
          blocks: [...blocks],
        },
      ],
    },
    {
      name: 'body',
      type: 'group',
      fields: [
        {
          name: 'blocks',
          type: 'blocks',
          blocks: [...blocks],
        },
      ],
    },
    {
      name: 'footer',
      type: 'group',
      fields: [
        {
          name: 'blocks',
          type: 'blocks',
          blocks: blocks,
        },
      ],
    },
  ],
}

export default Layouts

// import type { CollectionConfig } from "@revealui/core";
// import { Menu } from "../../blocks/Menu";
// import { PageContent } from '@/lib/blocks/PageContent/index';
// import { PageList } from '@/lib/blocks/PageList/index';
// import { ReusableContent } from '@/lib/blocks/ReusableContent/index';
// import { SiteTitle } from '@/lib/blocks/SiteTitle/index';

// const LayoutsField = {
//   title: "title",
//   name: "name",
//   slug: "slug",
//   description: "description",
// };
// type LayoutsField = (typeof LayoutsField)[keyof typeof LayoutsField];

// const blocks = [ReusableContent];

// const Layouts: CollectionConfig = {
//   slug: "layouts",
//   access: {
//     read: () => true,
//   },
//   admin: {
//     useAsTitle: LayoutsField.title,
//   },
//   fields: [
//     {
//       name: LayoutsField.name,
//       type: "text",
//       required: true,
//     },
//     {
//       name: LayoutsField.slug,
//       type: "text",
//       unique: true,
//       admin: {
//         position: "sidebar",
//       },
//     },
//     {
//       name: LayoutsField.description,
//       type: "text",
//     },
//     {
//       name: "header",
//       type: "group",
//       fields: [
//         {
//           name: "blocks",
//           type: "blocks",
//           blocks: [...blocks, Menu, SiteTitle],
//         },
//       ],
//     },
//     {
//       name: "body",
//       type: "group",
//       fields: [
//         {
//           name: "blocks",
//           type: "blocks",
//           blocks: [...blocks, PageContent, PageList],
//         },
//       ],
//     },
//     {
//       name: "footer",
//       type: "group",
//       fields: [
//         {
//           name: "blocks",
//           type: "blocks",
//           blocks: blocks,
//         },
//       ],
//     },
//   ],
// };

// export default Layouts;
