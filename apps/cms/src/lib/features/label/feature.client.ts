'use client'

// import {
//   createClientFeature,
//   slashMenuBasicGroupWithItems,
//   toolbarAddDropdownGroupWithItems,
// } from "@revealui/core/richtext-lexical/client";
// import { LabelNode, OPEN_LABEL_DRAWER_COMMAND } from "./nodes/LabelNode";
// import { LabelPlugin } from "./plugins/LabelPlugin";
// import LabelIcon from "./icons/LabelIcon";
// Define LabelFeatureClient with explicit type definitions
export const LabelFeatureClient: {
  path: string
  clientProps: Record<string, unknown>
  exportName: string
  serverProps: Record<string, unknown>
} = {
  path: 'label-feature-client',
  clientProps: {},
  exportName: '',
  serverProps: {},
  // Component: createClientFeature({
  //   plugins: [
  //     {
  //       Component: LabelPlugin,
  //       position: "normal",
  //     },
  //   ],
  //   nodes: [LabelNode],
  //   toolbarFixed: {
  //     groups: [
  //       toolbarAddDropdownGroupWithItems([
  //         {
  //           key: "label",
  //           ChildComponent: LabelIcon,
  //           label: "Label",
  //           onSelect: ({ editor }) => {
  //             editor.dispatchCommand(OPEN_LABEL_DRAWER_COMMAND, {});
  //           },
  //         },
  //       ]),
  //     ],
  //   },
  //   slashMenu: {
  //     groups: [
  //       slashMenuBasicGroupWithItems([
  //         {
  //           key: "label",
  //           label: "Label",
  //           onSelect: ({ editor }) => {
  //             editor.dispatchCommand(OPEN_LABEL_DRAWER_COMMAND, {});
  //           },
  //           keywords: ["label"],
  //           Icon: LabelIcon,
  //         },
  //       ]),
  //     ],
  //   },
  // }),
}

// "use client";

// import {
//   createClientFeature,
//   slashMenuBasicGroupWithItems,
//   toolbarAddDropdownGroupWithItems,
// } from "@revealui/core/richtext-lexical/client";
// import { LabelNode, OPEN_LABEL_DRAWER_COMMAND } from "./nodes/LabelNode";
// import { LabelPlugin } from "./plugins/LabelPlugin";
// import LabelIcon from "./icons/LabelIcon";
// import { RevealComponent } from "@revealui/core";

// export const LabelFeatureClient: RevealComponent = createClientFeature({
//   plugins: [
//     {
//       Component: LabelPlugin,
//       position: "normal",
//     },
//   ],
//   nodes: [LabelNode],
//   toolbarFixed: {
//     groups: [
//       toolbarAddDropdownGroupWithItems([
//         {
//           key: "label",
//           ChildComponent: LabelIcon,
//           label: "Label",
//           onSelect: ({ editor }) => {
//             editor.dispatchCommand(OPEN_LABEL_DRAWER_COMMAND, {});
//           },
//         },
//       ]),
//     ],
//   },
//   slashMenu: {
//     groups: [
//       slashMenuBasicGroupWithItems([
//         {
//           key: "label",
//           label: "Label",
//           onSelect: ({ editor }) => {
//             editor.dispatchCommand(OPEN_LABEL_DRAWER_COMMAND, {});
//           },
//           keywords: ["label"],
//           Icon: LabelIcon,
//         },
//       ]),
//     ],
//   },
// });
