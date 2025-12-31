/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  createClientFeature,
  slashMenuBasicGroupWithItems,
  toolbarAddDropdownGroupWithItems,
} from "@payloadcms/richtext-lexical/client";
import LargeBodyIcon from "./icons/LargeBodyIcon";
import LargeBodyPlugin from "./plugins/LargeBodyPlugin";
import { LargeBodyNode } from "./nodes/LargeBodyNode";
import { createCommand } from "lexical";

export const OPEN_LARGE_BODY_DRAWER_COMMAND = createCommand();

export const LargeBodyFeatureClient = createClientFeature({
  plugins: [
    {
      Component: LargeBodyPlugin as any,
      position: "normal",
    },
  ],
  nodes: [LargeBodyNode as any],
  toolbarFixed: {
    groups: [
      toolbarAddDropdownGroupWithItems([
        {
          key: "label",
          ChildComponent: LargeBodyIcon,
          label: "Label",
          onSelect: ({ editor }) => {
            editor.dispatchCommand(OPEN_LARGE_BODY_DRAWER_COMMAND, {});
          },
        },
      ]),
    ],
  },
  slashMenu: {
    groups: [
      slashMenuBasicGroupWithItems([
        {
          key: "largeBody",
          label: "Large Body",
          onSelect: ({ editor }) => {
            editor.dispatchCommand(OPEN_LARGE_BODY_DRAWER_COMMAND, {});
          },
          keywords: ["largeBody"],
          Icon: LargeBodyIcon,
        },
      ]),
    ],
  },
});
