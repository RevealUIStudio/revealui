import type { CollectionConfig } from "@revealui/cms";
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from "@revealui/cms/richtext-lexical";

import { Banner } from "../../blocks/Banner/config";
import { Code } from "../../blocks/Code/config";
import { MediaBlock } from "../../blocks/MediaBlock/config";
import { generatePreviewPath } from "../../utilities/generatePreviewPath";
import { populateAuthors } from "./hooks/populateAuthors";
import { revalidatePost } from "./hooks/revalidatePost";
import { authenticated } from "@/lib/access";
import { authenticatedOrPublished } from "@/lib/access/roles/authenticatedOrPublished";
import { slugField } from "@/lib/fields/slug";

export const Posts: CollectionConfig = {
  slug: "posts",
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
          path: `/posts/${typeof data?.slug === "string" ? data.slug : ""}`,
        });
        return `${process.env.NEXT_PUBLIC_SERVER_URL}${path}`;
      },
    },
    preview: (doc) =>
      generatePreviewPath({
        path: `/posts/${typeof doc?.slug === "string" ? doc.slug : ""}`,
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
          label: "Content",
          fields: [
            {
              name: "content",
              type: "richText",
              editor: lexicalEditor({
                features: ({ rootFeatures }) => [
                  ...rootFeatures,
                  HeadingFeature({
                    enabledHeadingSizes: ["h1", "h2", "h3", "h4"],
                  }),
                  BlocksFeature({ blocks: [Banner, Code, MediaBlock] }),
                  FixedToolbarFeature(),
                  InlineToolbarFeature(),
                  HorizontalRuleFeature(),
                ],
              }),
              label: false,
              required: true,
            },
          ],
        },
        {
          label: "Meta",
          fields: [
            {
              name: "relatedPosts",
              type: "relationship",
              admin: {
                position: "sidebar",
              },
              filterOptions: ({ id }) => ({
                id: {
                  not_in: [id],
                },
              }),
              hasMany: true,
              relationTo: "posts",
            },
            {
              name: "categories",
              type: "relationship",
              admin: {
                position: "sidebar",
              },
              hasMany: true,
              relationTo: "categories",
            },
          ],
        },
        {
          name: "meta",
          label: "SEO",
          fields: [
            {
              name: "image", // Ensure this is defined to avoid errors in PostHero
              type: "relationship", // Use the type that fits your setup
              relationTo: "media", // Assuming 'media' is your media collection
            },
            {
              name: "title", // Title for SEO
              type: "text",
            },
            {
              name: "description", // Description for SEO
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
        date: {
          pickerAppearance: "dayAndTime",
        },
        position: "sidebar",
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData._status === "published" && !value) {
              return new Date();
            }
            return value;
          },
        ],
      },
    },
    {
      name: "authors",
      type: "relationship",
      admin: {
        position: "sidebar",
      },
      hasMany: true,
      relationTo: "users",
    },
    {
      name: "populatedAuthors",
      type: "array",
      access: {
        update: () => false,
      },
      admin: {
        disabled: true,
        readOnly: true,
      },
      fields: [
        {
          name: "id",
          type: "text",
        },
        {
          name: "name",
          type: "text",
        },
      ],
    },
    ...slugField(),
  ],
  hooks: {
    afterChange: [revalidatePost],
    afterRead: [populateAuthors],
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

// import {
//   BlocksFeature,
//   FixedToolbarFeature,
//   HeadingFeature,
//   HorizontalRuleFeature,
//   InlineToolbarFeature,
//   lexicalEditor,
// } from "@payloadcms/richtext-lexical";

// import { Banner } from "../../blocks/Banner/config";
// import { Code } from "../../blocks/Code/config";
// import { MediaBlock } from "../../blocks/MediaBlock/config";
// import { generatePreviewPath } from "../../utilities/generatePreviewPath";
// import { populateAuthors } from "./hooks/populateAuthors";
// import { revalidatePost } from "./hooks/revalidatePost";

// // import {
// //   MetaDescriptionField,
// //   MetaImageField,
// //   MetaTitleField,
// //   OverviewField,
// //   PreviewField,
// // } from "@payloadcms/plugin-seo/fields";
// import { authenticated } from "@/access";
// import { authenticatedOrPublished } from "@/access/roles/authenticatedOrPublished";
// import { slugField } from "@/fields/slug";

// export const Posts: CollectionConfig = {
//   slug: "posts",
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
//           path: `/posts/${typeof data?.slug === "string" ? data.slug : ""}`,
//         });
//         return `${process.env.NEXT_PUBLIC_SERVER_URL}${path}`;
//       },
//     },
//     preview: (doc) =>
//       generatePreviewPath({
//         path: `/posts/${typeof doc?.slug === "string" ? doc.slug : ""}`,
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
//           fields: [
//             {
//               name: "content",
//               type: "richText",
//               editor: lexicalEditor({
//                 features: ({ rootFeatures }) => {
//                   return [
//                     ...rootFeatures,
//                     HeadingFeature({
//                       enabledHeadingSizes: ["h1", "h2", "h3", "h4"],
//                     }),
//                     BlocksFeature({ blocks: [Banner, Code, MediaBlock] }),
//                     FixedToolbarFeature(),
//                     InlineToolbarFeature(),
//                     HorizontalRuleFeature(),
//                   ];
//                 },
//               }),
//               label: false,
//               required: true,
//             },
//           ],
//           label: "Content",
//         },
//         {
//           fields: [
//             {
//               name: "relatedPosts",
//               type: "relationship",
//               admin: {
//                 position: "sidebar",
//               },
//               filterOptions: ({ id }) => {
//                 return {
//                   id: {
//                     not_in: [id],
//                   },
//                 };
//               },
//               hasMany: true,
//               relationTo: "posts",
//             },
//             {
//               name: "categories",
//               type: "relationship",
//               admin: {
//                 position: "sidebar",
//               },
//               hasMany: true,
//               relationTo: "categories",
//             },
//           ],
//           label: "Meta",
//         },
//         {
//           name: "meta",
//           label: "SEO",
//           fields: [
//             // OverviewField({
//             //   titlePath: "meta.title",
//             //   descriptionPath: "meta.description",
//             //   imagePath: "meta.image",
//             // }),
//             // MetaTitleField({
//             //   hasGenerateFn: true,
//             // }),
//             // MetaImageField({
//             //   relationTo: "media",
//             // }),
//             // MetaDescriptionField({}),
//             // PreviewField({
//             //   // if the `generateUrl` function is configured
//             //   hasGenerateFn: true,
//             //   // field paths to match the target field for data
//             //   titlePath: "meta.title",
//             //   descriptionPath: "meta.description",
//             // }),
//           ],
//         },
//       ],
//     },
//     {
//       name: "publishedAt",
//       type: "date",
//       admin: {
//         date: {
//           pickerAppearance: "dayAndTime",
//         },
//         position: "sidebar",
//       },
//       hooks: {
//         beforeChange: [
//           ({ siblingData, value }) => {
//             if (siblingData._status === "published" && !value) {
//               return new Date();
//             }
//             return value;
//           },
//         ],
//       },
//     },
//     {
//       name: "authors",
//       type: "relationship",
//       admin: {
//         position: "sidebar",
//       },
//       hasMany: true,
//       relationTo: "users",
//     },
//     // This field is only used to populate the user data via the `populateAuthors` hook
//     // This is because the `user` collection has access control locked to protect user privacy
//     //  will also not return mutated user data that differs from the underlying schema
//     {
//       name: "populatedAuthors",
//       type: "array",
//       access: {
//         update: () => false,
//       },
//       admin: {
//         disabled: true,
//         readOnly: true,
//       },
//       fields: [
//         {
//           name: "id",
//           type: "text",
//         },
//         {
//           name: "name",
//           type: "text",
//         },
//       ],
//     },
//     ...slugField(),
//   ],
//   hooks: {
//     afterChange: [revalidatePost],
//     afterRead: [populateAuthors],
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
