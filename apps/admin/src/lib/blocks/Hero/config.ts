import type { Block } from '@revealui/core';

import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@revealui/core/richtext';
import { linkGroup } from '@/lib/fields/linkGroup';

interface HeroBlockData {
  type?: 'none' | 'highImpact' | 'mediumImpact' | 'lowImpact';
}

/**
 * Hero as a first-class block.
 *
 * The canonical site-scoped pages model stores ALL page content in the
 * `blocks` jsonb column — there is no dedicated hero column. Under the
 * canonical-direct collection shape the hero therefore lives as the first
 * entry of `blocks` instead of the legacy dedicated `hero` group field.
 * The field set mirrors the legacy group (`lib/heros/config.ts`) one-to-one
 * so RenderHero renders the block's data unchanged.
 */
export const HeroBlock: Block = {
  slug: 'hero',
  interfaceName: 'HeroBlock',
  labels: {
    plural: 'Heroes',
    singular: 'Hero',
  },
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
          ];
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
        condition: (_: unknown, siblingData: HeroBlockData = {}) =>
          ['highImpact', 'mediumImpact'].includes(siblingData.type as string),
      },
      relationTo: 'media',
      required: true,
    },
  ],
};
