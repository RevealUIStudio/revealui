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
          Icon: LargeBodyIcon,
        },
      ]),
    ],
  },
});
