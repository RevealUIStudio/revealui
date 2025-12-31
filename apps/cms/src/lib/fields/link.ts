import type {Field} from "payload";

import deepMerge from "@/lib/utilities/deepMerge";

export type LinkAppearances = "default" | "outline";

export const appearanceOptions: Record<
  LinkAppearances,
  { label: string; value: string }
> = {
  default: {
    label: "Default",
    value: "default",
  },
  outline: {
    label: "Outline",
    value: "outline",
  },
};

type LinkType = (options?: {
  appearances?: LinkAppearances[] | false;
  disableLabel?: boolean;
  overrides?: Record<string, unknown>;
}) => Field;

export const link: LinkType = ({
  appearances,
  disableLabel = false,
  overrides = {},
} = {}) => {
  const linkResult: Field = {
    name: "link",
    type: "group",
    admin: {
      hideGutter: true,
    },
    fields: [
      {
        type: "row",
        fields: [
          {
            name: "type",
            type: "radio",
            admin: {
              layout: "horizontal",
              width: "50%",
            },
            defaultValue: "reference",
            options: [
              {
                label: "Internal link",
                value: "reference",
              },
              {
                label: "Custom URL",
                value: "custom",
              },
            ],
          },
          {
            name: "newTab",
            type: "checkbox",
            admin: {
              style: {
                alignSelf: "flex-end",
              },
              width: "50%",
            },
            label: "Open in new tab",
          },
        ],
      },
    ],
  };

  const linkTypes: Field[] = [
    {
      name: "reference",
      type: "relationship",
      admin: {
        condition: (_, siblingData) => siblingData?.type === "reference",
      },
      label: "Document to link to",
      maxDepth: 1,
      relationTo: ["pages"],
      required: true,
    },
    {
      name: "url",
      type: "text",
      admin: {
        condition: (_, siblingData) => siblingData?.type === "custom",
      },
      label: "Custom URL",
      required: true,
    },
  ];

  if (!disableLabel) {
    linkTypes.map((linkType) => ({
      ...linkType,
      admin: {
        ...linkType.admin,
        width: "50%",
      },
    }));

    linkResult.fields.push({
      type: "row",
      fields: [
        ...linkTypes,
        {
          name: "label",
          type: "text",
          admin: {
            width: "50%",
          },
          label: "Label",
          required: true,
        },
      ],
    });
  } else {
    linkResult.fields = [...linkResult.fields, ...linkTypes];
  }

  if (appearances !== false) {
    let appearanceOptionsToUse = [
      appearanceOptions.default,
      appearanceOptions.outline,
    ];

    if (appearances) {
      appearanceOptionsToUse = appearances.map(
        (appearance) => appearanceOptions[appearance],
      );
    }

    linkResult.fields.push({
      name: "appearance",
      type: "select",
      admin: {
        description: "Choose how the link should be rendered.",
      },
      defaultValue: "default",
      options: appearanceOptionsToUse,
    });
  }

  return deepMerge(linkResult, overrides);
};

// import { GroupField } from "payload";
// import deepMerge from "../hooks/deepMerge";

// // Define the appearance options
// export const appearanceOptions = {
//   primary: {
//     label: "Primary Button",
//     value: "primary",
//   },
//   secondary: {
//     label: "Secondary Button",
//     value: "secondary",
//   },
//   default: {
//     label: "Default",
//     value: "default",
//   },
//   outline: {
//     label: "Outline",
//     value: "outline",
//   },
//   inline: {
//     label: "Inline",
//     value: "inline",
//   },
//   destructive: {
//     label: "Destructive",
//     value: "destructive",
//   },
//   ghost: {
//     label: "Ghost",
//     value: "ghost",
//   },
//   link: {
//     label: "Link",
//     value: "link",
//   },
// };

// export type LinkAppearances =
//   | "link"
//   | "default"
//   | "primary"
//   | "secondary"
//   | "outline"
//   | "inline"
//   | "destructive"
//   | "ghost";

// export default function linkField(options?: {
//   appearances?: LinkAppearances[] | false;
//   disableLabel?: boolean;
//   overrides?: Record<string, unknown>;
// }): GroupField {
//   const { appearances, disableLabel = false, overrides = {} } = options || {};

//   const linkResult: GroupField = {
//     name: "link",
//     type: "group",
//     admin: { hideGutter: true },
//     fields: [
//       {
//         type: "row",
//         fields: [
//           {
//             name: "type",
//             type: "radio",
//             options: [
//               { label: "Internal link", value: "reference" },
//               { label: "Custom URL", value: "custom" },
//             ],
//             defaultValue: "reference",
//             admin: { layout: "horizontal", width: "50%" },
//           },
//           {
//             name: "newTab",
//             label: "Open in new tab",
//             type: "checkbox",
//             admin: { width: "50%", style: { alignSelf: "flex-end" } },
//           },
//         ],
//       },
//     ],
//   };

//   const linkTypes: GroupField["fields"] = [
//     {
//       name: "reference",
//       label: "Document to link to",
//       type: "relationship",
//       relationTo: ["pages"],
//       required: true,
//       admin: {
//         condition: (_, siblingData) => siblingData?.type === "reference",
//         width: "50%",
//       },
//     },
//     {
//       name: "url",
//       label: "Custom URL",
//       type: "text",
//       required: true,
//       admin: {
//         condition: (_, siblingData) => siblingData?.type === "custom",
//         width: "50%",
//       },
//     },
//   ];

//   if (!disableLabel) {
//     linkResult.fields.push({
//       type: "row",
//       fields: [
//         ...linkTypes,
//         {
//           name: "label",
//           label: "Label",
//           type: "text",
//           required: true,
//           admin: { width: "50%" },
//         },
//         { name: "icon", label: "Icon", type: "upload", relationTo: "media" },
//       ],
//     });
//   } else {
//     linkResult.fields.push(...linkTypes);
//   }

//   if (appearances !== false) {
//     const appearanceOptionsToUse = appearances
//       ? appearances.map((appearance) => appearanceOptions[appearance])
//       : [
//           appearanceOptions.default,
//           appearanceOptions.primary,
//           appearanceOptions.secondary,
//           appearanceOptions.outline,
//         ];

//     linkResult.fields.push({
//       name: "appearance",
//       type: "select",
//       defaultValue: "primary",
//       options: appearanceOptionsToUse,
//       admin: {
//         description: "Choose how the link should be rendered.",
//       },
//     });
//   }

//   return deepMerge(linkResult, overrides);
// }

// Function to create a link field with options
// export function linkField(options?: {
//   appearances?: LinkAppearances[] | false;
//   disableLabel?: boolean;
//   overrides?: Record<string, unknown>;
// }): GroupField {
//   const { appearances, disableLabel = false, overrides = {} } = options || {};

//   const linkResult: GroupField = {
//     name: "link",
//     type: "group",
//     admin: {
//       hideGutter: true,
//     },
//     fields: [
//       {
//         type: "row",
//         fields: [
//           {
//             name: "type",
//             type: "radio",
//             options: [
//               {
//                 label: "Internal link",
//                 value: "reference",
//               },
//               {
//                 label: "Custom URL",
//                 value: "custom",
//               },
//             ],
//             defaultValue: "reference",
//             admin: {
//               layout: "horizontal",
//               width: "50%",
//             },
//           },
//           {
//             name: "newTab",
//             label: "Open in new tab",
//             type: "checkbox",
//             admin: {
//               width: "50%",
//               style: {
//                 alignSelf: "flex-end",
//               },
//             },
//           },
//         ],
//       },
//     ],
//   };

//   const linkTypes: GroupField["fields"] = [
//     {
//       name: "reference",
//       label: "Document to link to",
//       type: "relationship",
//       relationTo: ["pages"],
//       required: true,
//       admin: {
//         condition: (_, siblingData) => siblingData?.type === "reference",
//         width: "50%",
//       },
//       hooks: {
//         afterRead: [
//           async ({ value, siblingData }) => {
//             if (value && siblingData.type === "reference") {
//               const id = value.value;
//               const pages = await payload.find({
//                 collection: "pages",
//                 where: {
//                   id: { equals: id },
//                 },
//                 depth: 0,
//               });

//               if (pages.docs[0]?.slug) siblingData.url = pages.docs[0].slug;
//             }
//           },
//         ],
//       },
//     },
//     {
//       name: "url",
//       label: "Custom URL",
//       type: "text",
//       required: true,
//       admin: {
//         condition: (_, siblingData) => siblingData?.type === "custom",
//         width: "50%",
//       },
//     },
//   ];

//   if (!disableLabel) {
//     linkResult.fields.push({
//       type: "row",
//       fields: [
//         ...linkTypes,
//         {
//           name: "label",
//           label: "Label",
//           type: "text",
//           required: true,
//           admin: {
//             width: "50%",
//           },
//         },
//         {
//           name: "icon",
//           label: "Icon",
//           type: "upload",
//           relationTo: "media",
//         },
//       ],
//     });
//   } else {
//     linkResult.fields.push(...linkTypes);
//   }

//   if (appearances !== false) {
//     let appearanceOptionsToUse = [
//       appearanceOptions.default,
//       appearanceOptions.primary,
//       appearanceOptions.secondary,
//     ];

//     if (appearances) {
//       appearanceOptionsToUse = appearances.map(
//         (appearance) => appearanceOptions[appearance],
//       );
//     }

//     linkResult.fields.push({
//       name: "appearance",
//       type: "select",
//       defaultValue: "primary",
//       options: appearanceOptionsToUse,
//       admin: {
//         description: "Choose how the link should be rendered.",
//       },
//     });
//   }

//   return deepMerge(linkResult, overrides);
// }

// export default linkField;
