import type { RevealCollectionConfig } from '@revealui/core'
import type { Price } from '@revealui/core/types/cms'
import { isAdmin } from '@/lib/access'
import { ArchiveBlock } from '@/lib/blocks/ArchiveBlock/config'
import { CallToAction } from '@/lib/blocks/CallToAction/config'
import { MediaBlock } from '@/lib/blocks/MediaBlock/config'
import { populateArchiveBlock } from '@/lib/hooks'
import { checkUserPurchases } from './access/checkUserPurchases'
import { beforePriceChange } from './hooks/beforeChange'
import { deletePriceFromCarts } from './hooks/deletePriceFromCarts'
import { revalidatePrice } from './hooks/revalidatePrice'

const Prices: RevealCollectionConfig<Price> = {
  slug: 'prices',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'stripePriceID', '_status'],
    preview: (doc: Record<string, unknown>) => {
      return `${import.meta.env.REVEALUI_PUBLIC_SERVER_URL}/api/preview?url=${encodeURIComponent(
        `${import.meta.env.REVEALUI_PUBLIC_SERVER_URL}/prices/${doc.slug}`,
      )}&secret=${import.meta.env.REVEALUI_DRAFT_SECRET}`
    },
  },
  hooks: {
    beforeChange: [beforePriceChange],
    afterChange: [revalidatePrice],
    afterRead: [populateArchiveBlock],
    afterDelete: [deletePriceFromCarts],
  },
  versions: {
    drafts: true,
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'publishedOn',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }: { siblingData?: { _status?: string }; value: unknown }) => {
            if (siblingData?._status === 'published' && !value) {
              return new Date()
            }
            return value
          },
        ],
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              blocks: [CallToAction /* Content */, MediaBlock, ArchiveBlock],
            },
          ],
        },
        {
          label: 'Price Details',
          fields: [
            {
              name: 'stripePriceID',
              label: 'Stripe Price',
              type: 'text',
              admin: {
                components: {
                  // biome-ignore lint/style/useNamingConvention: admin component keys use Field in RevealUI CMS.
                  Field: '@/lib/collections/Prices/ui/PricesSelect',
                },
              },
            },
            {
              name: 'priceJSON',
              label: 'Price JSON',
              type: 'textarea',
              admin: {
                readOnly: true,
                hidden: true,
                rows: 10,
              },
            },
            {
              name: 'enablePaywall',
              label: 'Enable Paywall',
              type: 'checkbox',
            },
            {
              name: 'paywall',
              label: 'Paywall',
              type: 'blocks',
              access: {
                // biome-ignore lint/suspicious/noExplicitAny: Field access function type compatibility requires this cast
                read: checkUserPurchases as any,
              },
              blocks: [CallToAction /* Content */, MediaBlock, ArchiveBlock],
            },
          ],
        },
      ],
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'relatedPrices',
      type: 'relationship',
      relationTo: 'prices',
      hasMany: true,
      filterOptions: ({ id }) => {
        return {
          id: {
            // biome-ignore lint/style/useNamingConvention: API filter operator uses snake_case.
            not_in: id ? [id] : [],
          },
        }
      },
    },
    {
      name: 'skipSync',
      label: 'Skip Sync',
      type: 'checkbox',
      admin: {
        position: 'sidebar',
        readOnly: true,
        hidden: true,
      },
    },
  ],
}

export default Prices

// import type { CollectionConfig } from "@revealui/core";
// import { checkUserPurchases } from "./access/checkUserPurchases.js";
// import { beforePriceChange } from "./hooks/beforeChange.js";
// import { deletePriceFromCarts } from "./hooks/deletePriceFromCarts.js";
// import { revalidatePrice } from "./hooks/revalidatePrice.js";
// import { CallToAction } from '@/lib/blocks/CallToAction/config';
// import { MediaBlock } from '@/lib/blocks/MediaBlock/config';
// import { ArchiveBlock } from '@/lib/blocks/ArchiveBlock/config';
// import { populateArchiveBlock } from "@/hooks";
// import { isAdmin } from "@/access";

// const Prices: CollectionConfig = {
//   slug: "prices",
//   admin: {
//     useAsTitle: "title",
//     defaultColumns: ["title", "stripePriceID", "_status"],
//     preview: (doc) => {
//       return `${
//         import.meta.env.REVEALUI_PUBLIC_SERVER_URL
//       }/api/preview?url=${encodeURIComponent(
//         `${import.meta.env.REVEALUI_PUBLIC_SERVER_URL}/prices/${doc.slug}`,
//       )}&secret=${import.meta.env.REVEALUI_DRAFT_SECRET}`;
//     },
//   },
//   hooks: {
//     beforeChange: [beforePriceChange],
//     afterChange: [revalidatePrice],
//     afterRead: [populateArchiveBlock],
//     afterDelete: [deletePriceFromCarts],
//   },
//   versions: {
//     drafts: true,
//   },
//   access: {
//     read: () => true,
//     create: isAdmin,
//     update: isAdmin,
//     delete: isAdmin,
//   },
//   fields: [
//     {
//       name: "title",
//       type: "text",
//       required: true,
//     },
//     {
//       name: "publishedOn",
//       type: "date",
//       admin: {
//         position: "sidebar",
//         date: {
//           pickerAppearance: "dayAndTime",
//         },
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
//       type: "tabs",
//       tabs: [
//         {
//           label: "Content",
//           fields: [
//             {
//               name: "layout",
//               type: "blocks",
//               blocks: [CallToAction /* Content */, MediaBlock, ArchiveBlock],
//             },
//           ],
//         },
//         {
//           label: "Price Details",
//           fields: [
//             {
//               name: "stripePriceID",
//               label: "Stripe Price",
//               type: "text",
//               admin: {
//                 components: {
//                   Field: "@/lib/collections/Prices/ui/PricesSelect",
//                 },
//               },
//             },
//             {
//               name: "priceJSON",
//               label: "Price JSON",
//               type: "textarea",
//               admin: {
//                 readOnly: true,
//                 hidden: true,
//                 rows: 10,
//               },
//             },
//             {
//               name: "enablePaywall",
//               label: "Enable Paywall",
//               type: "checkbox",
//             },
//             {
//               name: "paywall",
//               label: "Paywall",
//               type: "blocks",
//               access: {
//                 read: checkUserPurchases,
//               },
//               blocks: [CallToAction /* Content */, MediaBlock, ArchiveBlock],
//             },
//           ],
//         },
//       ],
//     },
//     {
//       name: "categories",
//       type: "relationship",
//       relationTo: "categories",
//       hasMany: true,
//       admin: {
//         position: "sidebar",
//       },
//     },
//     {
//       name: "relatedPrices",
//       type: "relationship",
//       relationTo: "prices",
//       hasMany: true,
//       filterOptions: ({ id }) => {
//         return {
//           id: {
//             not_in: [id],
//           },
//         };
//       },
//     },
//     {
//       name: "skipSync",
//       label: "Skip Sync",
//       type: "checkbox",
//       admin: {
//         position: "sidebar",
//         readOnly: true,
//         hidden: true,
//       },
//     },
//   ],
// };

// export default Prices;

// // import type { CollectionConfig } from "@revealui/core";
// // import { populateArchiveBlock } from "revealui/services/normalize/populateArchiveBlock";
// // import { CallToAction } from "../../../../../packages/utils/src/blocks/CallToAction";
// // import { Content } from "../../../../../packages/utils/src/blocks/Content";
// // import { MediaBlock } from "../../../../../packages/utils/src/blocks/MediaBlock";
// // // import { slugField } from "../../../../../packages/utils/src/fields/slug";
// // import { checkUserPurchases } from "./access/checkUserPurchases.js";
// // import { beforeProductChange } from "./hooks/beforeChange.js";
// // import { deleteProductFromCarts } from "./hooks/deleteProductFromCarts";
// // import { revalidateProduct } from "./hooks/revalidateProduct";
// // import { Priceselect } from "./ui/Priceselect";
// // import { admins } from "revealui/access";
// // import { ArchiveBlock } from "revealui/blocks/ArchiveBlock";

// // const Prices: CollectionConfig = {
// //   slug: "Prices",
// //   admin: {
// //     useAsTitle: "title",
// //     defaultColumns: ["title", "stripeProductID", "_status"],
// //     preview: (doc) => {
// //       return `${
// //         import.meta.env.REVEALUI_PUBLIC_SERVER_URL
// //       }/api/preview?url=${encodeURIComponent(
// //         //
// //         `${import.meta.env.REVEALUI_PUBLIC_SERVER_URL}/Prices/${doc.slug}`,
// //       )}&secret=${import.meta.env.REVEALUI_DRAFT_SECRET}`;
// //     },
// //   },
// //   hooks: {
// //     beforeChange: [beforeProductChange],
// //     afterChange: [revalidateProduct],
// //     afterRead: [populateArchiveBlock],
// //     afterDelete: [deleteProductFromCarts],
// //   },
// //   versions: {
// //     drafts: true,
// //   },
// //   access: {
// //     read: () => true,
// //     create: admins,
// //     update: admins,
// //     delete: admins,
// //   },
// //   fields: [
// //     {
// //       name: "title",
// //       type: "text",
// //       required: true,
// //     },
// //     {
// //       name: "publishedOn",
// //       type: "date",
// //       admin: {
// //         position: "sidebar",
// //         date: {
// //           pickerAppearance: "dayAndTime",
// //         },
// //       },
// //       hooks: {
// //         beforeChange: [
// //           ({ siblingData, value }) => {
// //             if (siblingData._status === "published" && !value) {
// //               return new Date();
// //             }
// //             return value;
// //           },
// //         ],
// //       },
// //     },
// //     {
// //       type: "tabs",
// //       tabs: [
// //         {
// //           label: "Content",
// //           fields: [
// //             {
// //               name: "layout",
// //               type: "blocks",
// //               blocks: [CallToAction, Content, MediaBlock, ArchiveBlock],
// //             },
// //           ],
// //         },
// //         {
// //           label: "Product Details",
// //           fields: [
// //             {
// //               name: "stripeProductID",
// //               label: "Stripe Product",
// //               type: "text",
// //               admin: {
// //                 components: {
// //                   Field: Priceselect,
// //                 },
// //               },
// //             },
// //             {
// //               name: "priceJSON",
// //               label: "Price JSON",
// //               type: "textarea",
// //               admin: {
// //                 readOnly: true,
// //                 hidden: true,
// //                 rows: 10,
// //               },
// //             },
// //             {
// //               name: "enablePaywall",
// //               label: "Enable Paywall",
// //               type: "checkbox",
// //             },
// //             {
// //               name: "paywall",
// //               label: "Paywall",
// //               type: "blocks",
// //               access: {
// //                 read: checkUserPurchases,
// //               },
// //               blocks: [CallToAction, Content, MediaBlock, ArchiveBlock],
// //             },
// //           ],
// //         },
// //       ],
// //     },
// //     {
// //       name: "categories",
// //       type: "relationship",
// //       relationTo: "categories",
// //       hasMany: true,
// //       admin: {
// //         position: "sidebar",
// //       },
// //     },
// //     {
// //       name: "relatedPrices",
// //       type: "relationship",
// //       relationTo: "Prices",
// //       hasMany: true,
// //       filterOptions: ({ id }) => {
// //         return {
// //           id: {
// //             not_in: [id],
// //           },
// //         };
// //       },
// //     },
// //     // slugField(),
// //     {
// //       name: "skipSync",
// //       label: "Skip Sync",
// //       type: "checkbox",
// //       admin: {
// //         position: "sidebar",
// //         readOnly: true,
// //         hidden: true,
// //       },
// //     },
// //   ],
// // };

// // export default Prices;
