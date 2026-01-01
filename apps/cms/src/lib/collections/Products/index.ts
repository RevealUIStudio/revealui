import { isAdmin } from "@/lib/access";
import { populateArchiveBlock } from "@/lib/hooks";
import type { CollectionConfig } from "@revealui/cms";
import { ArchiveBlock } from "../../blocks/ArchiveBlock/config";
import { CallToAction } from "../../blocks/CallToAction/config";
import { MediaBlock } from "../../blocks/MediaBlock/config";
import { checkUserPurchases } from "./access/checkUserPurchases";
import { beforeProductChange } from "./hooks/beforeChange";
import { deleteProductFromCarts } from "./hooks/deleteProductFromCarts";
import { revalidateProduct } from "./hooks/revalidateProduct";
// import { ProductSelect } from "./ui/ProductSelect";

const Products: CollectionConfig = {
  slug: "products",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "stripeProductID", "_status"],
    preview: (doc) => {
      return `${
        import.meta.env.PAYLOAD_PUBLIC_SERVER_URL
      }/api/preview?url=${encodeURIComponent(
        `${import.meta.env.PAYLOAD_PUBLIC_SERVER_URL}/products/${doc.slug}`,
      )}&secret=${import.meta.env.PAYLOAD_PUBLIC_DRAFT_SECRET}`;
    },
  },
  hooks: {
    beforeChange: [beforeProductChange],
    afterChange: [revalidateProduct],
    afterRead: [populateArchiveBlock],
    afterDelete: [deleteProductFromCarts],
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
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "publishedOn",
      type: "date",
      admin: {
        position: "sidebar",
        date: {
          pickerAppearance: "dayAndTime",
        },
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
      type: "tabs",
      tabs: [
        {
          label: "Content",
          fields: [
            {
              name: "layout",
              type: "blocks",
              blocks: [CallToAction /* Content */, MediaBlock, ArchiveBlock],
            },
          ],
        },
        {
          label: "Product Details",
          fields: [
            {
              name: "stripeProductID",
              label: "Stripe Product",
              type: "text",
              admin: {
                components: {
                  // Field: ProductSelect,
                },
              },
            },
            {
              name: "priceJSON",
              label: "Price JSON",
              type: "textarea",
              admin: {
                readOnly: true,
                hidden: true,
                rows: 10,
              },
            },
            {
              name: "enablePaywall",
              label: "Enable Paywall",
              type: "checkbox",
            },
            {
              name: "paywall",
              label: "Paywall",
              type: "blocks",
              access: {
                read: checkUserPurchases,
              },
              blocks: [CallToAction /* Content */, MediaBlock, ArchiveBlock],
            },
          ],
        },
      ],
    },
    {
      name: "categories",
      type: "relationship",
      relationTo: "categories",
      hasMany: true,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "relatedProducts",
      type: "relationship",
      relationTo: "products",
      hasMany: true,
      filterOptions: ({ id }) => {
        return {
          id: {
            not_in: [id],
          },
        };
      },
    },
    {
      name: "skipSync",
      label: "Skip Sync",
      type: "checkbox",
      admin: {
        position: "sidebar",
        readOnly: true,
        hidden: true,
      },
    },
  ],
};

export default Products;

// import type { CollectionConfig } from "@revealui/cms";
// import { populateArchiveBlock } from "reveal/src/payload/services/normalize/populateArchiveBlock";
// import { CallToAction } from "../../../../../packages/utils/src/payload/blocks/CallToAction";
// import { Content } from "../../../../../packages/utils/src/payload/blocks/Content";
// import { MediaBlock } from "../../../../../packages/utils/src/payload/blocks/MediaBlock";
// // import { slugField } from "../../../../../packages/utils/src/payload/fields/slug";
// import { checkUserPurchases } from "./access/checkUserPurchases";
// import { beforeProductChange } from "./hooks/beforeChange";
// import { deleteProductFromCarts } from "./hooks/deleteProductFromCarts";
// import { revalidateProduct } from "./hooks/revalidateProduct";
// import { ProductSelect } from "./ui/ProductSelect";
// import { admins } from "reveal/src/payload/access";
// import { ArchiveBlock } from "reveal/src/payload/blocks/ArchiveBlock";

// const Products: CollectionConfig = {
//   slug: "products",
//   admin: {
//     useAsTitle: "title",
//     defaultColumns: ["title", "stripeProductID", "_status"],
//     preview: (doc) => {
//       return `${
//         import.meta.env.PAYLOAD_PUBLIC_SERVER_URL
//       }/api/preview?url=${encodeURIComponent(
//         // eslint-disable-next-line prettier/prettier
//         `${import.meta.env.PAYLOAD_PUBLIC_SERVER_URL}/products/${doc.slug}`,
//       )}&secret=${import.meta.env.PAYLOAD_PUBLIC_DRAFT_SECRET}`;
//     },
//   },
//   hooks: {
//     beforeChange: [beforeProductChange],
//     afterChange: [revalidateProduct],
//     afterRead: [populateArchiveBlock],
//     afterDelete: [deleteProductFromCarts],
//   },
//   versions: {
//     drafts: true,
//   },
//   access: {
//     read: () => true,
//     create: admins,
//     update: admins,
//     delete: admins,
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
//               blocks: [CallToAction, Content, MediaBlock, ArchiveBlock],
//             },
//           ],
//         },
//         {
//           label: "Product Details",
//           fields: [
//             {
//               name: "stripeProductID",
//               label: "Stripe Product",
//               type: "text",
//               admin: {
//                 components: {
//                   Field: ProductSelect,
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
//               blocks: [CallToAction, Content, MediaBlock, ArchiveBlock],
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
//       name: "relatedProducts",
//       type: "relationship",
//       relationTo: "products",
//       hasMany: true,
//       filterOptions: ({ id }) => {
//         return {
//           id: {
//             not_in: [id],
//           },
//         };
//       },
//     },
//     // slugField(),
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

// export default Products;
