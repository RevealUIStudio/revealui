/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";
import type {
  CustomComponent,
  FieldDescriptionClientComponent,
  FieldDescriptionServerComponent,
  PayloadComponent,
  RichTextField,
} from "revealui/cms";
import { link } from "../fields/link";
import deepMerge from "../hooks/deepMerge";

type Admin = {
  components?: {
    Error?: CustomComponent<any>;
    Label?: CustomComponent<any>;
    Cell?: CustomComponent<any>;
    // Description removed due to type incompatibility with PayloadCMS v3
    Field?: CustomComponent<any>;
    Filter?: PayloadComponent<any, any>;
  };
  upload?: {
    collections?: {
      media?: {
        fields?: any[];
      };
    };
  };
};

const richText = (overrides: Partial<{ admin: Admin }> = {}): RichTextField => {
  const defaultAdminConfig: Admin = {
    upload: {
      collections: {
        media: {
          fields: [
            { type: "richText", name: "caption", label: "Caption" },
            {
              type: "radio",
              name: "alignment",
              label: "Alignment",
              options: [
                { label: "Left", value: "left" },
                { label: "Center", value: "center" },
                { label: "Right", value: "right" },
              ],
            },
            { name: "enableLink", type: "checkbox", label: "Enable Link" },
            link({
              appearances: false,
              disableLabel: true,
              overrides: {
                admin: {
                  condition: (_: any, siblingData: { enableLink: boolean }) =>
                    Boolean(siblingData.enableLink),
                },
              },
            }),
          ],
        },
      },
    },
    components: {
      Error: undefined, // You can provide your custom error component here if needed
      Label: undefined, // Same for label
      Cell: undefined,
      // Description removed to avoid type conflicts with PayloadCMS v3
      Field: undefined,
      Filter: undefined,
    },
  };

  const adminConfig = deepMerge(defaultAdminConfig, overrides.admin || {});

  const fieldOverrides = { ...(overrides || {}) };

  return deepMerge<RichTextField, Partial<RichTextField>>(
    {
      type: "richText",
      name: "richText",
      required: true,
      admin: adminConfig,
    },
    fieldOverrides,
  );
};

export default richText;

// type Admin = {
//   components?: {
//     Error?: CustomComponent<typeof ErrorProps>;
//     Label?: CustomComponent<typeof LabelProps>;
//   };
//   upload?: {
//     collections?: {
//       media?: {
//         fields?: any[];
//       };
//     };
//   };
// };
// const richText = (
//   overrides: Partial<{ admin: Admin }> = {}
// ): RichTextField => {
//   const defaultAdminConfig: Admin = {
//     upload: {
//       collections: {
//         media: {
//           fields: [
//             { type: "richText", name: "caption", label: "Caption" },
//             {
//               type: "radio",
//               name: "alignment",
//               label: "Alignment",
//               options: [
//                 { label: "Left", value: "left" },
//                 { label: "Center", value: "center" },
//                 { label: "Right", value: "right" },
//               ],
//             },
//             { name: "enableLink", type: "checkbox", label: "Enable Link" },
//             linkField({
//               appearances: false,
//               disableLabel: true,
//               overrides: { admin: {
//                 ErrorProps: "",
//                 LabelProps: ""
//                } },
//             }),
//           ],
//         },
//       },
//     },
//   };

//   const adminConfig = deepMerge(defaultAdminConfig, overrides.admin || {});

//   const fieldOverrides = { ...(overrides || {}) };

//   return deepMerge<RichTextField, Partial<RichTextField>>(
//     {
//       type: "richText",
//       name: "richText",
//       required: true,
//       admin: adminConfig,
//     },
//     fieldOverrides
//   );
// };

// export default richText;

// type Admin = {
//   components?: {
//     Error?: CustomComponent<typeof ErrorProps>;
//     Label?: CustomComponent<typeof LabelProps>;
//   };
//   upload?: {
//     collections?: {
//       media?: {
//         fields?: any[];
//       };
//     };
//   };
// };

// const richText = (
//   overrides: Partial<{
//     admin: Admin;
//   }> = {},
// ) => {
//   // Define default structure for options including custom field configurations
//   const defaultAdminConfig: Admin = {
//     upload: {
//       collections: {
//         media: {
//           fields: [
//             {
//               type: "richText",
//               name: "caption",
//               label: "Caption",
//             },
//             {
//               type: "radio",
//               name: "alignment",
//               label: "Alignment",
//               options: [
//                 { label: "Left", value: "left" },
//                 { label: "Center", value: "center" },
//                 { label: "Right", value: "right" },
//               ],
//             },
//             {
//               name: "enableLink",
//               type: "checkbox",
//               label: "Enable Link",
//               admin: {},
//             },
//             linkField({
//               appearances: false,
//               disableLabel: true,
//               overrides: {
//                 admin: {},
//               },
//             }),
//           ],
//         },
//       },
//     },
//   };

//   // Use deepMerge to combine the default admin configuration with any overrides
//   const adminConfig = deepMerge(defaultAdminConfig, overrides.admin || {});

//   const fieldOverrides = {
//     ...(overrides || {}),
//   };

//   return deepMerge<RichTextField, Partial<RichTextField>>(
//     {
//       type: "richText",
//       name: "richText",
//       required: true,
//       admin: adminConfig as Admin,
//     },
//     fieldOverrides,
//   );
// };

// export default richText;

// /* eslint-disable prettier/prettier */
// /* eslint-disable @typescript-eslint/no-explicit-any */

// // // TODO: Implement local rich text feature
// TODO: Implement local alternative
// import // @payloadcms/richtext-lexical'
// import type { ErrorProps, LabelProps, RichTextField } from 'payload'
// import { CustomComponent } from 'payload'
// import linkField from '../fields/linkField'
// import deepMerge from '../hooks/deepMerge'

// // type Admin = AdapterArguments["admin"] & {
// type Admin = any['admin'] & {
//   components?: {
//     Error?: CustomComponent<ErrorProps>
//     Label?: CustomComponent<LabelProps>
//   }
// }

// const richText = (
//   overrides = {
//     admin: {}
//   }
//   // additions = { elements: [] }
// ) => {
//   // Define default structure for slate options including custom field configurations
//   // const defaultAdminConfig: AdapterArguments["admin"] = {
//   const defaultAdminConfig: any['admin'] = {
//     // elements: [...elements, ...(additions.elements || [])],
//     upload: {
//       collections: {
//         media: {
//           fields: [
//             {
//               type: 'richText',
//               name: 'caption',
//               label: 'Caption'
//               // editor: lexicalEditor({})
//             },
//             {
//               type: 'radio',
//               name: 'alignment',
//               label: 'Alignment',
//               options: [
//                 { label: 'Left', value: 'left' },
//                 { label: 'Center', value: 'center' },
//                 { label: 'Right', value: 'right' }
//               ]
//             },
//             {
//               name: 'enableLink',
//               type: 'checkbox',
//               label: 'Enable Link',
//               admin: {
//                 // condition: (_: any, data: { enableLink?: boolean }) =>
//                 //   !!data.enableLink
//               }
//             },
//             linkField({
//               appearances: false,
//               disableLabel: true,
//               overrides: {
//                 admin: {
//                   // condition: (_: any, data: { enableLink?: boolean }) =>
//                   //   !!data.enableLink
//                 }
//               }
//             })
//           ]
//         }
//       }
//     }
//   }

//   // Use deepMerge to combine the default admin configuration with any overrides
//   const adminConfig = deepMerge(
//     defaultAdminConfig,
//     overrides.admin || {}
//   ) as Admin

//   const fieldOverrides = {
//     ...(overrides || {})
//   }

//   return deepMerge<RichTextField, Partial<RichTextField>>(
//     {
//       type: 'richText',
//       name: 'richText',
//       required: true,
//       admin: adminConfig as Admin & {
//         components?: {
//           Error?: CustomComponent<ErrorProps>
//           Label?: CustomComponent<LabelProps>
//         }
//       }
//       // editor: lexicalEditor({ admin: adminConfig })
//     },
//     fieldOverrides
//   )
// }

// export default richText
