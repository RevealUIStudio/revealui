import type { Field } from '@revealui/cms'

import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@revealui/cms/richtext-lexical'
import { linkGroup } from '../fields/linkGroup'

interface HeroData {
  type?: 'none' | 'highImpact' | 'mediumImpact' | 'lowImpact';
}

export const hero: Field = {
  name: 'hero',
  type: 'group',
  fields: [
    {
      name: 'type',
      type: 'select',
      defaultValue: 'lowImpact',
      label: 'Type',
      options: [
        {
          label: 'None',
          value: 'none',
        },
        {
          label: 'High Impact',
          value: 'highImpact',
        },
        {
          label: 'Medium Impact',
          value: 'mediumImpact',
        },
        {
          label: 'Low Impact',
          value: 'lowImpact',
        },
      ],
      required: true,
    },
    {
      name: 'richText',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
            FixedToolbarFeature(),
            InlineToolbarFeature(),
          ]
        },
      }),
      label: false,
    },
    linkGroup({
      overrides: {
        maxRows: 2,
      },
    }),
    {
      name: 'media',
      type: 'upload',
      admin: {
        condition: (_: unknown, siblingData: HeroData = {}) => ['highImpact', 'mediumImpact'].includes(siblingData.type as string),
      },
      relationTo: 'media',
      required: true,
    },
  ],
  label: false,
}

// /* eslint-disable @typescript-eslint/no-explicit-any */
// import type { Field } from "@revealui/cms"
// // import richText from "../richText";
// import linkGroupField from "../linkGroupField"

// export const heroField: Field = {
//   name: "hero",
//   label: false,
//   type: "group",
//   fields: [
//     {
//       name: "type",
//       type: "select",
//       label: "Type",
//       required: true,
//       defaultValue: "lowImpact",
//       options: [
//         {
//           label: "None",
//           value: "none",
//         },
//         {
//           label: "High Impact",
//           value: "highImpact",
//         },
//         {
//           label: "Medium Impact",
//           value: "mediumImpact",
//         },
//         {
//           label: "Low Impact",
//           value: "lowImpact",
//         },
//         {
//           label: "Custom Hero",
//           value: "customHero",
//         },
//       ],
//     },
//     // richText({
//     //   admin: {
//     //     // To Do: Add Component to rich text admin field
//     //     components: { Label: "", Error: "" },
//     //   },
//     // }),
//     linkGroupField({
//       overrides: {
//         maxRows: 2,
//       },
//     }),
//     {
//       name: "media",
//       type: "upload",
//       relationTo: "media",
//       required: true,
//       admin: {
//         // condition: (_, { type } = {}) =>
//         //   ["highImpact", "mediumImpact", "customHero"].includes(type),
//       },
//     },
//   ],
// }
