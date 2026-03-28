'use client';

import {
  createClientFeature,
  type LexicalEditor,
  slashMenuBasicGroupWithItems,
  toolbarAddDropdownGroupWithItems,
} from '@revealui/core/richtext/client';
import type { ComponentType } from 'react';
import { EmbedIcon } from './icons/EmbedIcon';
import { EmbedNode, OPEN_EMBED_DRAWER_COMMAND } from './nodes/EmbedNode';
import { EmbedPlugin } from './plugins/EmbedPlugin';

export const EmbedFeatureClient = createClientFeature({
  plugins: [
    {
      Component: EmbedPlugin as ComponentType<unknown>,
      position: 'normal',
    },
  ],
  nodes: [EmbedNode],
  toolbarFixed: {
    groups: [
      toolbarAddDropdownGroupWithItems([
        {
          key: 'embed',
          ChildComponent: EmbedIcon,
          label: 'Embed',
          onSelect: ({ editor }: { editor: LexicalEditor }) => {
            editor.dispatchCommand(OPEN_EMBED_DRAWER_COMMAND, {});
          },
        },
      ]),
    ],
  },
  slashMenu: {
    groups: [
      slashMenuBasicGroupWithItems([
        {
          key: 'embed',
          label: 'Embed',
          onSelect: ({ editor }: { editor: LexicalEditor }) => {
            editor.dispatchCommand(OPEN_EMBED_DRAWER_COMMAND, {});
          },
          keywords: ['embed'],
          Icon: EmbedIcon,
        },
      ]),
    ],
  },
});
