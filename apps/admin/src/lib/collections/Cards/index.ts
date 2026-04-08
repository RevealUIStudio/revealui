import type { AccessArgs, CollectionConfig } from '@revealui/core';

const Cards: CollectionConfig = {
  slug: 'cards',
  // auth is omitted - this collection doesn't use authentication
  access: {
    create: ({ req }: AccessArgs) => !!req?.user,
    read: () => true,
    update: ({ req }: AccessArgs) => !!req?.user,
    delete: ({ req }: AccessArgs) => !!req?.user,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'label',
      type: 'text',
    },
    {
      name: 'cta',
      type: 'text',
    },
    {
      name: 'href',
      type: 'text',
    },
    {
      name: 'loading',
      type: 'radio',
      options: ['eager', 'lazy'],
      defaultValue: 'eager',
    },
  ],
};

export default Cards;
