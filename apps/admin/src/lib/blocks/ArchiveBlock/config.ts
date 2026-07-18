import type { Block } from '@revealui/core';

import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@revealui/core/richtext';

interface ArchiveBlockData {
  populateBy?: 'collection' | 'selection';
}

export const ArchiveBlock: Block = {
  slug: 'archive',
  interfaceName: 'ArchiveBlock',
  fields: [
    {
      name: 'introContent',
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
      label: 'Intro Content',
    },
    {
      name: 'populateBy',
      type: 'select',
      defaultValue: 'collection',
      options: [
        {
          label: 'Collection',
          value: 'collection',
        },
        {
          label: 'Individual Selection',
          value: 'selection',
        },
      ],
    },
    {
      name: 'relationTo',
      type: 'select',
      admin: {
        condition: (_: unknown, siblingData: ArchiveBlockData) =>
          siblingData?.populateBy === 'collection',
      },
      defaultValue: 'posts',
      label: 'Collections To Show',
      options: [
        {
          label: 'Posts',
          value: 'posts',
        },
      ],
    },
    // WIRE-UP-PENDING — the `categories` relationship is disabled: its target
    // `categories` collection has no backing table and is unregistered (see
    // collections/registry.ts). ArchiveBlock is a live block (offered by Pages
    // and rendered as `archive`), so it must not reference an unregistered
    // slug. Re-enable once a `categories` migration + registration land.
    // {
    //   name: 'categories',
    //   type: 'relationship',
    //   admin: {
    //     condition: (_: unknown, siblingData: ArchiveBlockData) =>
    //       siblingData?.populateBy === 'collection',
    //   },
    //   hasMany: true,
    //   label: 'Categories To Show',
    //   relationTo: 'categories',
    // },
    {
      name: 'limit',
      type: 'number',
      admin: {
        condition: (_: unknown, siblingData: ArchiveBlockData) =>
          siblingData?.populateBy === 'collection',
        step: 1,
      },
      defaultValue: 10,
      label: 'Limit',
    },
    {
      name: 'selectedDocs',
      type: 'relationship',
      admin: {
        condition: (_: unknown, siblingData: ArchiveBlockData) =>
          siblingData?.populateBy === 'selection',
      },
      hasMany: true,
      label: 'Selection',
      relationTo: ['posts'],
    },
  ],
  labels: {
    plural: 'Archives',
    singular: 'Archive',
  },
};
