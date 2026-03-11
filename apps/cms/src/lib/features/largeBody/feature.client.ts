'use client';

import {
  createClientFeature,
  type LexicalEditor,
  slashMenuBasicGroupWithItems,
  toolbarAddDropdownGroupWithItems,
} from '@revealui/core/richtext/client';
import { createCommand } from 'lexical';
import type { ComponentType } from 'react';
import LargeBodyIcon from './icons/LargeBodyIcon';
import { LargeBodyNode } from './nodes/LargeBodyNode';
import LargeBodyPlugin from './plugins/LargeBodyPlugin';

export const OPEN_LARGE_BODY_DRAWER_COMMAND = createCommand();

export const LargeBodyFeatureClient = createClientFeature({
  plugins: [
    {
      // biome-ignore lint/style/useNamingConvention: Rich text plugin API uses Component.
      Component: LargeBodyPlugin as ComponentType<unknown>,
      position: 'normal',
    },
  ],
  nodes: [LargeBodyNode],
  toolbarFixed: {
    groups: [
      toolbarAddDropdownGroupWithItems([
        {
          key: 'label',
          // biome-ignore lint/style/useNamingConvention: Rich text toolbar API uses ChildComponent.
          ChildComponent: LargeBodyIcon,
          label: 'Label',
          onSelect: ({ editor }: { editor: LexicalEditor }) => {
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
          key: 'largeBody',
          label: 'Large Body',
          onSelect: ({ editor }: { editor: LexicalEditor }) => {
            editor.dispatchCommand(OPEN_LARGE_BODY_DRAWER_COMMAND, {});
          },
          keywords: ['largeBody'],
          // biome-ignore lint/style/useNamingConvention: Rich text slash menu API uses Icon.
          Icon: LargeBodyIcon,
        },
      ]),
    ],
  },
});
