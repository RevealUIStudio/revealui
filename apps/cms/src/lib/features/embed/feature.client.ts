'use client'

import {
  createClientFeature,
  type LexicalEditor,
  slashMenuBasicGroupWithItems,
  toolbarAddDropdownGroupWithItems,
} from '@revealui/core/richtext/client'
import { EmbedIcon } from './icons/EmbedIcon.js'
import { EmbedNode, OPEN_EMBED_DRAWER_COMMAND } from './nodes/EmbedNode.js'
import { EmbedPlugin } from './plugins/EmbedPlugin.js'

export const EmbedFeatureClient = createClientFeature({
  plugins: [
    {
      // biome-ignore lint/style/useNamingConvention: Rich text plugin API uses Component.
      Component: EmbedPlugin,
      position: 'normal',
    },
  ],
  nodes: [EmbedNode],
  toolbarFixed: {
    groups: [
      toolbarAddDropdownGroupWithItems([
        {
          key: 'embed',
          // biome-ignore lint/style/useNamingConvention: Rich text toolbar API uses ChildComponent.
          ChildComponent: EmbedIcon,
          label: 'Embed',
          onSelect: ({ editor }: { editor: LexicalEditor }) => {
            editor.dispatchCommand(OPEN_EMBED_DRAWER_COMMAND, {})
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
            editor.dispatchCommand(OPEN_EMBED_DRAWER_COMMAND, {})
          },
          keywords: ['embed'],
          // biome-ignore lint/style/useNamingConvention: Rich text slash menu API uses Icon.
          Icon: EmbedIcon,
        },
      ]),
    ],
  },
})
