import type { CollectionConfig } from '@revealui/core';
import { anyone, authenticated, isAdmin } from '@/lib/access';

const Banners: CollectionConfig = {
  slug: 'banners',
  // auth is omitted - this collection does not use authentication
  access: {
    create: authenticated,
    read: anyone,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'alt',
      type: 'text',
    },
    {
      name: 'heading',
      type: 'text',
    },
    {
      name: 'subheading',
      type: 'text',
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'cta',
      type: 'text',
    },
    {
      name: 'highlight',
      type: 'text',
    },
    {
      name: 'punctuation',
      type: 'text',
    },
    {
      name: 'stats',
      type: 'array',
      fields: [
        {
          name: 'label',
          type: 'text',
        },
        {
          name: 'value',
          type: 'text',
        },
      ],
    },
    {
      name: 'link',
      type: 'group',
      fields: [
        {
          name: 'href',
          type: 'text',
        },
        {
          name: 'text',
          type: 'text',
        },
      ],
    },
  ],
};

export default Banners;
