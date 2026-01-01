// ReusableContent block not found - commenting out for now
// import { ReusableContent } from "@/lib/blocks/ReusableContent";
// import {SiteTitle} from "@/blocks/SiteTitle";
import type { CollectionConfig } from "@revealui/cms";

const LayoutsField = {
  title: "title",
  name: "name",
  slug: "slug",
  description: "description",
};

export type LayoutFieldKey = (typeof LayoutsField)[keyof typeof LayoutsField];

// ReusableContent block not found - using empty array for now
const blocks: any[] = [];

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
      type: "text",
      required: true,
    },
    {
      name: LayoutsField.slug,
      type: "text",
      unique: true,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: LayoutsField.description,
      type: "text",
    },
    {
      name: "header",
      type: "group",
      fields: [
        {
          name: "blocks",
          type: "blocks",
          blocks: [...blocks],
        },
      ],
    },
    {
      name: "body",
      type: "group",
      fields: [
        {
          name: "blocks",
          type: "blocks",
          blocks: [...blocks],
        },
      ],
    },
    {
      name: "footer",
      type: "group",
      fields: [
        {
          name: "blocks",
          type: "blocks",
          blocks: blocks,
        },
      ],
    },
  ],
};

export default Layouts;

// import type { CollectionConfig } from "@revealui/cms";
// import { Menu } from "../../blocks/Menu";
// import { PageContent } from "../../blocks/PageContent";
// import { PageList } from "../../blocks/PageList";
// import { ReusableContent } from "../../blocks/ReusableContent";
// import { SiteTitle } from "../../blocks/SiteTitle";

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
