import type { CollectionConfig } from '@revealui/core';
import { anyone, authenticated, isAdmin } from '@/lib/access';

const Heros: CollectionConfig = {
  slug: 'heros',
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
      admin: {
        description: 'Hero image',
      },
    },
    {
      name: 'video',
      type: 'text',
      admin: {
        description: 'Video URL (YouTube, Vimeo, or uploaded media URL)',
      },
    },
    {
      name: 'href',
      type: 'text',
      admin: {
        description: 'Call to Action URL',
      },
    },
    {
      name: 'altText',
      type: 'text',
      required: false,
      admin: {
        description: 'Alt text for the hero image',
      },
    },
  ],
};

export default Heros;
