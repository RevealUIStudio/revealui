import type { Block, CollectionConfig } from '@revealui/core';

const LayoutsField = {
  title: 'title',
  name: 'name',
  slug: 'slug',
  description: 'description',
};

export type LayoutFieldKey = (typeof LayoutsField)[keyof typeof LayoutsField];

const blocks: Block[] = [];

const Layouts: CollectionConfig = {
  slug: LayoutsField.slug,
  access: {
    read: () => true,
  },
  admin: {},
  fields: [
    {
      name: LayoutsField.name,
      type: 'text',
      required: true,
    },
    {
      name: LayoutsField.slug,
      type: 'text',
      unique: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: LayoutsField.description,
      type: 'text',
    },
    {
      name: 'header',
      type: 'group',
      fields: [
        {
          name: 'blocks',
          type: 'blocks',
          blocks: [...blocks],
        },
      ],
    },
    {
      name: 'body',
      type: 'group',
      fields: [
        {
          name: 'blocks',
          type: 'blocks',
          blocks: [...blocks],
        },
      ],
    },
    {
      name: 'footer',
      type: 'group',
      fields: [
        {
          name: 'blocks',
          type: 'blocks',
          blocks: blocks,
        },
      ],
    },
  ],
};

export default Layouts;
